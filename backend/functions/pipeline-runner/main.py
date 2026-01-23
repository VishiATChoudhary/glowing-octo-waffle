"""
Pipeline Runner Cloud Function.

Orchestrates the research paper discovery pipeline:
1. Expand keywords using GenAI (generate related search terms)
2. Search papers (arXiv, Semantic Scholar, OpenAlex) for all keywords
3. Extract unique researchers from papers
4. Analyze market viability for each paper (LLM)
5. Enrich researchers via Perplexity (email, lab, country)
6. Aggregate viability scores per researcher
7. Save to Cloud SQL PostgreSQL database

Streams logs via Server-Sent Events (SSE).
"""

import json
import logging
import os
import time
import traceback
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
from typing import Generator

import functions_framework
import requests
from dotenv import load_dotenv
from flask import Request, Response

# Load .env file BEFORE importing database (which reads env vars at import time)
_env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    # Also try current directory
    load_dotenv()

import database


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles datetime objects."""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def json_dumps(obj) -> str:
    """Serialize object to JSON string, handling datetime objects."""
    return json.dumps(obj, cls=DateTimeEncoder)


def error_payload(context: str, exc: Exception) -> dict:
    """Build an error payload and include a stack trace when DEV_MODE is enabled."""
    logging.exception("%s failed: %s", context, exc)
    payload = {"success": False, "error": str(exc), "context": context}
    if os.environ.get("DEV_MODE", "").upper() == "TRUE":
        payload["trace"] = traceback.format_exc()
    return payload

# =============================================================================
# Configuration
# =============================================================================

ARXIV_API_URL = "https://export.arxiv.org/api/query"
S2_API_URL = "https://api.semanticscholar.org/graph/v1"
OPENALEX_API_URL = "https://api.openalex.org"
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Auth API URL for quota checks
AUTH_API_URL = os.environ.get(
    "AUTH_API_URL",
    "https://us-central1-waffle-mm.cloudfunctions.net"
)

PERPLEXITY_MODEL = "sonar-pro"
OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-2.0-flash"

# In-memory tracking for manual mode sessions (session_id -> uid)
# This ensures search + continue counts as 1 run
_session_users: dict[str, str] = {}
_counted_sessions: set[str] = set()


# =============================================================================
# Logging
# =============================================================================

def create_log(
    step: str,
    status: str,
    message: str,
    data: dict | None = None
) -> str:
    """Create a log entry in SSE format."""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "step": step,
        "status": status,
        "message": message,
    }
    if data:
        log_entry["data"] = data
    return f"data: {json.dumps(log_entry)}\n\n"


# =============================================================================
# API Clients
# =============================================================================

def search_arxiv(query: str, max_results: int = 20) -> list[dict]:
    """Search arXiv for papers."""
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    response = requests.get(ARXIV_API_URL, params=params, timeout=30)
    response.raise_for_status()

    # Parse XML response
    root = ET.fromstring(response.text)
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    papers = []
    for entry in root.findall("atom:entry", ns):
        arxiv_id = entry.find("atom:id", ns).text.split("/abs/")[-1]

        authors = []
        for author in entry.findall("atom:author", ns):
            name = author.find("atom:name", ns)
            if name is not None:
                authors.append(name.text)

        paper = {
            "id": f"arxiv-{arxiv_id}",
            "arxivId": arxiv_id,
            "title": entry.find("atom:title", ns).text.replace("\n", " ").strip(),
            "abstract": entry.find("atom:summary", ns).text.replace("\n", " ").strip(),
            "authors": authors,
            "year": int(entry.find("atom:published", ns).text[:4]),
            "source": "arXiv",
            "url": entry.find("atom:id", ns).text,
            "citations": 0,
        }

        # Get PDF link
        for link in entry.findall("atom:link", ns):
            if link.get("title") == "pdf":
                paper["pdfUrl"] = link.get("href")

        papers.append(paper)

    return papers


def search_semantic_scholar(query: str, max_results: int = 20) -> list[dict]:
    """Search Semantic Scholar for papers."""
    params = {
        "query": query,
        "limit": max_results,
        "fields": "paperId,title,abstract,year,citationCount,authors,externalIds,url",
    }

    headers = {}
    api_key = os.environ.get("S2_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key

    response = requests.get(
        f"{S2_API_URL}/paper/search",
        params=params,
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    papers = []

    for item in data.get("data", []):
        paper = {
            "id": f"s2-{item['paperId']}",
            "title": item.get("title", ""),
            "abstract": item.get("abstract", "") or "",
            "authors": [a.get("name", "") for a in item.get("authors", [])],
            "year": item.get("year") or datetime.now().year,
            "source": "Semantic Scholar",
            "url": item.get("url", ""),
            "citations": item.get("citationCount", 0),
        }

        # Extract external IDs
        external_ids = item.get("externalIds", {})
        if external_ids:
            paper["doi"] = external_ids.get("DOI")
            paper["arxivId"] = external_ids.get("ArXiv")

        papers.append(paper)

    return papers


def search_openalex(query: str, max_results: int = 20) -> list[dict]:
    """Search OpenAlex for papers."""
    params = {
        "search": query,
        "per_page": max_results,
    }

    email = os.environ.get("OPENALEX_EMAIL")
    if email:
        params["mailto"] = email

    response = requests.get(f"{OPENALEX_API_URL}/works", params=params, timeout=30)
    response.raise_for_status()

    data = response.json()
    papers = []

    for item in data.get("results", []):
        # Reconstruct abstract from inverted index
        abstract = ""
        inverted_index = item.get("abstract_inverted_index")
        if inverted_index:
            words = []
            for word, positions in inverted_index.items():
                for pos in positions:
                    words.append((pos, word))
            words.sort(key=lambda x: x[0])
            abstract = " ".join(w[1] for w in words)

        # Extract authors
        authors = []
        for authorship in item.get("authorships", []):
            author = authorship.get("author", {})
            if author.get("display_name"):
                authors.append(author["display_name"])

        openalex_id = item.get("id", "").split("/")[-1]

        paper = {
            "id": f"oa-{openalex_id}",
            "title": item.get("display_name", item.get("title", "")),
            "abstract": abstract,
            "authors": authors,
            "year": item.get("publication_year") or datetime.now().year,
            "source": "OpenAlex",
            "url": item.get("id", ""),
            "citations": item.get("cited_by_count", 0),
            "doi": item.get("doi"),
        }

        papers.append(paper)

    return papers


def deduplicate_papers(papers: list[dict]) -> list[dict]:
    """Deduplicate papers by title similarity and IDs."""
    seen_titles = set()
    seen_dois = set()
    seen_arxiv = set()
    unique = []

    for paper in papers:
        # Normalize title for comparison
        title_key = paper.get("title", "").lower().strip()[:100]
        doi = paper.get("doi")
        arxiv_id = paper.get("arxivId")

        # Check for duplicates
        is_duplicate = False

        if doi and doi in seen_dois:
            is_duplicate = True
        elif arxiv_id and arxiv_id in seen_arxiv:
            is_duplicate = True
        elif title_key in seen_titles:
            is_duplicate = True

        if not is_duplicate:
            unique.append(paper)
            seen_titles.add(title_key)
            if doi:
                seen_dois.add(doi)
            if arxiv_id:
                seen_arxiv.add(arxiv_id)

    return unique


# =============================================================================
# Keyword Expansion
# =============================================================================

def expand_keywords_gemini(query: str, num_keywords: int = 5) -> list[str]:
    """
    Use Google Gemini to generate related search keywords.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return []

    prompt = f"""Given this research topic query: "{query}"

Generate {num_keywords} related but distinct search queries that would help find relevant academic papers on this topic.

Consider:
- Alternative terminology and synonyms
- Related sub-topics or applications
- Different technical approaches
- Broader or narrower scope variations
- Industry applications

Return ONLY a JSON object with a "keywords" array containing the search queries (strings).
Do NOT include the original query in the list.
Each keyword should be 2-5 words for effective paper search.

Example response format:
{{"keywords": ["keyword one", "keyword two", "keyword three"]}}"""

    try:
        url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 300,
                    "responseMimeType": "application/json",
                }
            },
            timeout=30,
        )
        response.raise_for_status()

        # Parse Gemini response
        result = response.json()
        content = result["candidates"][0]["content"]["parts"][0]["text"]

        # Parse JSON from response
        parsed = json.loads(content)
        keywords = parsed.get("keywords", [])

        # Ensure we have valid strings and limit count
        keywords = [k.strip() for k in keywords if isinstance(k, str) and k.strip()][:num_keywords]
        return keywords

    except Exception as e:
        print(f"Gemini keyword expansion error: {e}")
        return []


def expand_keywords_openai(query: str, num_keywords: int = 5) -> list[str]:
    """
    Use OpenAI to generate related search keywords.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return []

    prompt = f"""Given this research topic query: "{query}"

Generate {num_keywords} related but distinct search queries that would help find relevant academic papers on this topic.

Consider:
- Alternative terminology and synonyms
- Related sub-topics or applications
- Different technical approaches
- Broader or narrower scope variations
- Industry applications

Return ONLY a JSON object with a "keywords" array containing the search queries (strings).
Do NOT include the original query in the list.
Each keyword should be 2-5 words for effective paper search."""

    try:
        response = requests.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a research assistant that helps discover academic papers. Generate diverse, relevant search queries. Return JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.7,
                "max_tokens": 300,
            },
            timeout=30,
        )
        response.raise_for_status()

        content = response.json()["choices"][0]["message"]["content"]
        result = json.loads(content)

        keywords = result.get("keywords", [])
        # Ensure we have valid strings and limit count
        keywords = [k.strip() for k in keywords if isinstance(k, str) and k.strip()][:num_keywords]
        return keywords

    except Exception as e:
        print(f"OpenAI keyword expansion error: {e}")
        return []


def expand_keywords(query: str, num_keywords: int = 5) -> list[str]:
    """
    Use GenAI to generate related search keywords from the original query.
    Tries Gemini first, then falls back to OpenAI.
    Returns a list of related keywords/phrases to search for.
    """
    # Try Gemini first
    if os.environ.get("GEMINI_API_KEY"):
        keywords = expand_keywords_gemini(query, num_keywords)
        if keywords:
            return keywords

    # Fall back to OpenAI
    if os.environ.get("OPENAI_API_KEY"):
        keywords = expand_keywords_openai(query, num_keywords)
        if keywords:
            return keywords

    # No API key available, return just the original query
    return [query]


# =============================================================================
# Researcher Extraction
# =============================================================================

def normalize_name(name: str) -> str:
    """
    Normalize researcher name for deduplication.
    Handles variations like "J. Smith" vs "John Smith" vs "Smith, John".
    """
    import re

    # Remove extra whitespace
    name = " ".join(name.split())

    # Handle "Last, First" format
    if "," in name:
        parts = name.split(",", 1)
        if len(parts) == 2:
            name = f"{parts[1].strip()} {parts[0].strip()}"

    # Lowercase for comparison
    name = name.lower().strip()

    # Remove titles/suffixes
    for suffix in [" jr", " sr", " ii", " iii", " iv", " phd", " md", " dr"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)]

    # Remove periods from initials (J. -> J)
    name = re.sub(r'\.(?=\s|$)', '', name)

    # Normalize unicode characters
    name = name.replace("ö", "o").replace("ü", "u").replace("ä", "a")
    name = name.replace("é", "e").replace("è", "e").replace("ê", "e")
    name = name.replace("ñ", "n").replace("ç", "c")

    return name


def extract_researchers(papers: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Extract unique researchers from papers.
    Returns (researchers, authorship_links).
    Deduplicates by normalized name.
    """
    researcher_map = {}  # normalized_name -> researcher dict
    authorship_links = []

    for paper in papers:
        for author_name in paper.get("authors", []):
            if not author_name or not author_name.strip():
                continue

            name_key = normalize_name(author_name)

            # Skip very short names (likely parsing errors)
            if len(name_key) < 3:
                continue

            if name_key not in researcher_map:
                researcher_id = f"researcher-{uuid.uuid4().hex[:12]}"
                researcher_map[name_key] = {
                    "id": researcher_id,
                    "name": author_name.strip(),  # Keep original formatting
                    "email": None,
                    "institution": None,
                    "lab": None,
                    "country": None,
                    "hIndex": None,
                    "citations": None,
                    "enrichedAt": None,
                    "aggregateViability": None,
                }

            # Create authorship link
            authorship_links.append({
                "paperId": paper["id"],
                "researcherId": researcher_map[name_key]["id"],
                "role": "author",
            })

    return list(researcher_map.values()), authorship_links


# =============================================================================
# Market Viability Analysis
# =============================================================================

def _get_viability_prompt(paper: dict) -> str:
    """Generate the viability analysis prompt."""
    return f"""Analyze the commercial/market viability of this research paper.

Title: {paper.get('title', 'Unknown')}

Abstract: {paper.get('abstract', 'No abstract available')[:1500]}

Rate each dimension from 1-5:
1. Novelty (1=incremental, 5=breakthrough)
2. Market Size (1=niche, 5=massive market)
3. Feasibility (1=decades away, 5=ready for commercialization)
4. Timing (1=too early, 5=perfect timing)

Provide a brief analysis (2-3 sentences) of the commercial potential.

Return ONLY a JSON object with keys: novelty, marketSize, feasibility, timing, analysis
Example: {{"novelty": 4, "marketSize": 3, "feasibility": 5, "timing": 4, "analysis": "..."}}"""


def _parse_viability_result(result: dict) -> dict:
    """Parse and validate viability scores."""
    return {
        "novelty": min(5, max(1, int(result.get("novelty", 3)))),
        "marketSize": min(5, max(1, int(result.get("marketSize", result.get("market_size", 3))))),
        "feasibility": min(5, max(1, int(result.get("feasibility", 3)))),
        "timing": min(5, max(1, int(result.get("timing", 3)))),
        "analysis": result.get("analysis", ""),
    }


def analyze_viability_gemini(paper: dict) -> dict | None:
    """Analyze viability using Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    prompt = _get_viability_prompt(paper)

    try:
        url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 500,
                    "responseMimeType": "application/json",
                }
            },
            timeout=30,
        )
        response.raise_for_status()

        result = response.json()
        content = result["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(content)
        return _parse_viability_result(parsed)

    except Exception as e:
        print(f"Gemini viability error: {e}")
        return None


def analyze_viability_openai(paper: dict) -> dict | None:
    """Analyze viability using OpenAI."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None

    prompt = _get_viability_prompt(paper)

    try:
        response = requests.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a technology commercialization expert. Analyze research papers for market viability. Return your response as JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
                "max_tokens": 500,
            },
            timeout=30,
        )
        response.raise_for_status()

        content = response.json()["choices"][0]["message"]["content"]
        result = json.loads(content)
        return _parse_viability_result(result)

    except Exception as e:
        print(f"OpenAI viability error: {e}")
        return None


def analyze_viability(paper: dict) -> dict:
    """
    Analyze market viability of a paper using LLM.
    Tries Gemini first, then falls back to OpenAI.
    Returns viability scores (novelty, marketSize, feasibility, timing).
    """
    # Try Gemini first
    result = analyze_viability_gemini(paper)
    if result:
        return result

    # Fall back to OpenAI
    result = analyze_viability_openai(paper)
    if result:
        return result

    # No API key or all failed
    return {
        "novelty": 3,
        "marketSize": 3,
        "feasibility": 3,
        "timing": 3,
        "analysis": "No LLM API key configured (set GEMINI_API_KEY or OPENAI_API_KEY)",
    }


# =============================================================================
# Researcher Enrichment
# =============================================================================

def enrich_researcher(name: str, affiliation: str | None = None) -> dict:
    """
    Enrich researcher info using Perplexity API.
    Returns email, lab, institution, country.
    """
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        return {"found": False, "error": "No Perplexity API key configured"}

    affiliation_text = f" who is affiliated with {affiliation}" if affiliation else ""
    prompt = f"""Find professional contact information for academic researcher {name}{affiliation_text}.

Search for their:
1. Institutional/academic email address
2. Current research lab, department, or research group name
3. Current university or institution name
4. Country where they are based

Return accurate information only. If you cannot find specific information, leave it null."""

    try:
        response = requests.post(
            PERPLEXITY_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": PERPLEXITY_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a research assistant that finds academic researcher contact information. Provide accurate, factual information only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "email": {"type": "string", "description": "Institutional email address"},
                                "lab": {"type": "string", "description": "Research lab or group name"},
                                "institution": {"type": "string", "description": "University or institution name"},
                                "country": {"type": "string", "description": "Country where based"},
                                "found": {"type": "boolean", "description": "Whether the researcher was found"},
                            },
                            "required": ["found"],
                        }
                    },
                },
                "temperature": 0.1,
                "max_tokens": 500,
            },
            timeout=30,
        )
        response.raise_for_status()

        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)

    except Exception as e:
        return {"found": False, "error": str(e)}


# =============================================================================
# Aggregate Viability
# =============================================================================

def compute_aggregate_viability(
    researcher_id: str,
    authorship_links: list[dict],
    papers: list[dict],
    viability: dict
) -> dict:
    """
    Compute aggregate viability scores for a researcher.
    Uses citation-weighted average.
    """
    # Get papers for this researcher
    paper_ids = [
        link["paperId"]
        for link in authorship_links
        if link["researcherId"] == researcher_id
    ]

    if not paper_ids:
        return None

    # Get papers with viability scores
    paper_map = {p["id"]: p for p in papers}
    researcher_papers = [paper_map[pid] for pid in paper_ids if pid in paper_map]

    if not researcher_papers:
        return None

    # Calculate citation-weighted averages
    total_citations = sum(max(1, p.get("citations", 0)) for p in researcher_papers)

    weighted_novelty = 0
    weighted_market = 0
    weighted_feasibility = 0
    weighted_timing = 0

    for paper in researcher_papers:
        scores = viability.get(paper["id"], {})
        weight = max(1, paper.get("citations", 0))

        weighted_novelty += scores.get("novelty", 3) * weight
        weighted_market += scores.get("marketSize", 3) * weight
        weighted_feasibility += scores.get("feasibility", 3) * weight
        weighted_timing += scores.get("timing", 3) * weight

    avg_novelty = weighted_novelty / total_citations
    avg_market = weighted_market / total_citations
    avg_feasibility = weighted_feasibility / total_citations
    avg_timing = weighted_timing / total_citations

    # Weighted average overall (equal weights)
    weighted_avg = (avg_novelty + avg_market + avg_feasibility + avg_timing) / 4

    return {
        "paperCount": len(researcher_papers),
        "avgNovelty": round(avg_novelty, 2),
        "avgMarketSize": round(avg_market, 2),
        "avgFeasibility": round(avg_feasibility, 2),
        "avgTiming": round(avg_timing, 2),
        "weightedAvg": round(weighted_avg, 2),
    }


# =============================================================================
# Pipeline Phases (Split for manual mode)
# =============================================================================

def run_search_phase(
    query: str,
    sources: list[str],
    max_results: int,
    skip_viability: bool = False,
    skip_expansion: bool = False,
    num_keywords: int = 5,
) -> Generator[str, None, None]:
    """
    Run Phase 1: keyword expansion, paper search, and optional viability analysis.
    Yields log entries as SSE data.
    Final event contains 'papers_ready' type with papers and viability scores.
    """
    all_papers = []
    viability_scores = {}
    session_id = uuid.uuid4().hex[:16]

    # -------------------------------------------------------------------------
    # Step 1: Expand Keywords
    # -------------------------------------------------------------------------
    search_queries = [query]  # Always include original query

    if not skip_expansion:
        yield create_log("expand", "start", f"Generating related keywords for \"{query}\"...")

        try:
            expanded = expand_keywords(query, num_keywords)
            if expanded:
                search_queries.extend(expanded)
                yield create_log(
                    "expand", "progress",
                    f"Generated {len(expanded)} related keywords"
                )
                for kw in expanded:
                    yield create_log("expand", "progress", f"  + {kw}")

            yield create_log(
                "expand", "complete",
                f"Will search for {len(search_queries)} queries total",
                {"keywords": search_queries, "keywordCount": len(search_queries)}
            )
        except Exception as e:
            yield create_log("expand", "error", f"Keyword expansion failed: {str(e)}")
            yield create_log("expand", "complete", "Continuing with original query only")
    else:
        yield create_log("expand", "complete", "Skipped keyword expansion")

    # -------------------------------------------------------------------------
    # Step 2: Search Papers (for each keyword)
    # -------------------------------------------------------------------------
    yield create_log("search", "start", f"Starting paper search for {len(search_queries)} queries...")

    # Calculate results per query to stay within limits
    results_per_query = max(1, max_results // len(search_queries))

    for query_idx, search_query in enumerate(search_queries):
        yield create_log(
            "search", "progress",
            f"Searching query {query_idx + 1}/{len(search_queries)}: \"{search_query}\""
        )

        # Search each source for this query
        if "arxiv" in sources:
            try:
                arxiv_papers = search_arxiv(search_query, results_per_query)
                all_papers.extend(arxiv_papers)
                if arxiv_papers:
                    yield create_log("search", "progress", f"  arXiv: {len(arxiv_papers)} papers")
            except Exception as e:
                yield create_log("search", "error", f"  arXiv failed: {str(e)}")

        if "semantic-scholar" in sources:
            try:
                s2_papers = search_semantic_scholar(search_query, results_per_query)
                all_papers.extend(s2_papers)
                if s2_papers:
                    yield create_log("search", "progress", f"  Semantic Scholar: {len(s2_papers)} papers")
            except Exception as e:
                yield create_log("search", "error", f"  Semantic Scholar failed: {str(e)}")

        if "openalex" in sources:
            try:
                oa_papers = search_openalex(search_query, results_per_query)
                all_papers.extend(oa_papers)
                if oa_papers:
                    yield create_log("search", "progress", f"  OpenAlex: {len(oa_papers)} papers")
            except Exception as e:
                yield create_log("search", "error", f"  OpenAlex failed: {str(e)}")

        # Small delay between queries to avoid rate limiting
        if query_idx < len(search_queries) - 1:
            time.sleep(0.5)

    # Deduplicate
    unique_papers = deduplicate_papers(all_papers)
    yield create_log(
        "search", "complete",
        f"Found {len(all_papers)} total, deduplicated to {len(unique_papers)} unique papers",
        {"paperCount": len(unique_papers), "totalFound": len(all_papers)}
    )

    if not unique_papers:
        yield create_log("search", "error", "No papers found. Try a different query.")
        return

    # -------------------------------------------------------------------------
    # Step 3: Analyze Market Viability (optional)
    # -------------------------------------------------------------------------
    if not skip_viability:
        yield create_log("viability", "start", f"Analyzing market viability (0/{len(unique_papers)})...")

        for i, paper in enumerate(unique_papers):
            if (i + 1) % 10 == 0 or i == len(unique_papers) - 1:
                yield create_log(
                    "viability", "progress",
                    f"Analyzing market viability ({i + 1}/{len(unique_papers)})..."
                )

            scores = analyze_viability(paper)
            viability_scores[paper["id"]] = scores

            # Add aggregate score to the scores dict
            agg = (scores["novelty"] + scores["marketSize"] + scores["feasibility"] + scores["timing"]) / 4
            scores["aggregate"] = round(agg, 2)

            # Small delay to avoid rate limiting
            time.sleep(0.1)

        yield create_log(
            "viability", "complete",
            f"Completed viability analysis for {len(unique_papers)} papers"
        )
    else:
        yield create_log("viability", "complete", "Skipped viability analysis")

    # -------------------------------------------------------------------------
    # Emit final papers_ready event
    # -------------------------------------------------------------------------
    # Prepare papers with embedded viability for frontend
    papers_with_viability = []
    for paper in unique_papers:
        p = dict(paper)
        if paper["id"] in viability_scores:
            p["viability"] = viability_scores[paper["id"]]
        papers_with_viability.append(p)

    final_data = {
        "type": "papers_ready",
        "sessionId": session_id,
        "papers": papers_with_viability,
        "keywords": search_queries,
        "viabilityScores": viability_scores,
    }
    yield f"data: {json.dumps(final_data)}\n\n"


def run_processing_phase(
    session_id: str,
    selected_papers: list[dict],
    keywords: list[str],
    viability_scores: dict[str, dict],
    skip_enrichment: bool = False,
    max_researchers: int = 0,
) -> Generator[str, None, None]:
    """
    Run Phase 2: researcher extraction, enrichment, aggregation, and save.
    Only processes papers that were selected by the user.
    Yields log entries as SSE data.
    """
    # -------------------------------------------------------------------------
    # Step 1: Extract Researchers from selected papers
    # -------------------------------------------------------------------------
    yield create_log("extract", "start", f"Extracting researchers from {len(selected_papers)} selected papers...")

    researchers, authorship_links = extract_researchers(selected_papers)

    yield create_log(
        "extract", "complete",
        f"Found {len(researchers)} unique researchers",
        {"researcherCount": len(researchers)}
    )

    # -------------------------------------------------------------------------
    # Step 2: Enrich Researchers
    # -------------------------------------------------------------------------
    enriched_count = 0
    not_found_count = 0

    if not skip_enrichment:
        # Apply researcher limit if set
        researchers_to_enrich = researchers
        if max_researchers > 0 and len(researchers) > max_researchers:
            researchers_to_enrich = researchers[:max_researchers]
            yield create_log(
                "enrich", "start",
                f"Enriching {len(researchers_to_enrich)} of {len(researchers)} researchers (limit: {max_researchers})..."
            )
        else:
            yield create_log("enrich", "start", f"Enriching {len(researchers_to_enrich)} researchers...")

        for i, researcher in enumerate(researchers_to_enrich):
            yield create_log(
                "enrich", "progress",
                f"[{i + 1}/{len(researchers_to_enrich)}] Enriching: {researcher['name']}..."
            )

            result = enrich_researcher(researcher["name"])

            if result.get("found"):
                researcher["email"] = result.get("email")
                researcher["lab"] = result.get("lab")
                researcher["institution"] = result.get("institution")
                researcher["country"] = result.get("country")
                researcher["enrichedAt"] = datetime.utcnow().isoformat()
                enriched_count += 1

                # Log detailed enrichment results
                found_fields = []
                if result.get("email"):
                    found_fields.append(f"email: {result.get('email')}")
                if result.get("institution"):
                    found_fields.append(f"institution: {result.get('institution')}")
                if result.get("lab"):
                    found_fields.append(f"lab: {result.get('lab')}")
                if result.get("country"):
                    found_fields.append(f"country: {result.get('country')}")

                if found_fields:
                    yield create_log(
                        "enrich", "progress",
                        f"  Found: {', '.join(found_fields)}"
                    )
                else:
                    yield create_log(
                        "enrich", "progress",
                        f"  Found but no contact details available"
                    )
            else:
                not_found_count += 1
                error_msg = result.get("error", "Not found")
                yield create_log(
                    "enrich", "progress",
                    f"  Not found: {error_msg}"
                )

            # Delay to avoid rate limiting
            time.sleep(0.5)

        yield create_log(
            "enrich", "complete",
            f"Enriched {enriched_count}/{len(researchers_to_enrich)} researchers ({not_found_count} not found)",
            {"enrichedCount": enriched_count, "notFoundCount": not_found_count}
        )
    else:
        yield create_log("enrich", "complete", "Skipped researcher enrichment")

    # -------------------------------------------------------------------------
    # Step 3: Compute Aggregate Viability
    # -------------------------------------------------------------------------
    yield create_log("aggregate", "start", "Computing viability aggregates...")

    for researcher in researchers:
        aggregate = compute_aggregate_viability(
            researcher["id"],
            authorship_links,
            selected_papers,
            viability_scores
        )
        researcher["aggregateViability"] = aggregate

    yield create_log(
        "aggregate", "complete",
        f"Computed aggregates for {len(researchers)} researchers"
    )

    # -------------------------------------------------------------------------
    # Step 4: Save to Database
    # -------------------------------------------------------------------------
    yield create_log("save", "start", "Saving to database...")

    try:
        # Mark selected papers as flagged and embed viability scores
        selected_ids = {p["id"] for p in selected_papers}
        new_papers = database.save_papers(
            selected_papers,
            keywords,
            viability_scores=viability_scores,
            flagged_ids=selected_ids
        )
        new_researchers, researcher_id_mapping = database.save_researchers(researchers)
        filtered_viability = {
            paper_id: scores
            for paper_id, scores in viability_scores.items()
            if paper_id in selected_ids
        }
        database.save_viability(filtered_viability)  # Keep for backward compatibility
        database.save_authorship(authorship_links, researcher_id_mapping)

        stats = database.get_stats()
        yield create_log(
            "save", "complete",
            "Pipeline complete!",
            {
                "papersTotal": stats["papers"],
                "researchersTotal": stats["researchers"],
                "newPapers": new_papers,
                "newResearchers": new_researchers,
            }
        )

    except Exception as e:
        yield create_log("save", "error", f"Failed to save: {str(e)}")


# =============================================================================
# Pipeline Runner (Full - for Auto Mode)
# =============================================================================

def run_pipeline(
    query: str,
    sources: list[str],
    max_results: int,
    skip_viability: bool = False,
    skip_enrichment: bool = False,
    skip_expansion: bool = False,
    num_keywords: int = 5,
    max_researchers: int = 0,
    auto_mode: bool = False,
    viability_threshold: float = 3.5,
) -> Generator[str, None, None]:
    """
    Run the complete pipeline with SSE log streaming.
    Yields log entries as SSE data.
    """
    all_papers = []
    researchers = []
    authorship_links = []
    viability_scores = {}

    # -------------------------------------------------------------------------
    # Step 1: Expand Keywords
    # -------------------------------------------------------------------------
    search_queries = [query]  # Always include original query

    if not skip_expansion:
        yield create_log("expand", "start", f"Generating related keywords for \"{query}\"...")

        try:
            expanded = expand_keywords(query, num_keywords)
            if expanded:
                search_queries.extend(expanded)
                yield create_log(
                    "expand", "progress",
                    f"Generated {len(expanded)} related keywords"
                )
                for kw in expanded:
                    yield create_log("expand", "progress", f"  + {kw}")

            yield create_log(
                "expand", "complete",
                f"Will search for {len(search_queries)} queries total",
                {"keywords": search_queries, "keywordCount": len(search_queries)}
            )
        except Exception as e:
            yield create_log("expand", "error", f"Keyword expansion failed: {str(e)}")
            yield create_log("expand", "complete", "Continuing with original query only")
    else:
        yield create_log("expand", "complete", "Skipped keyword expansion")

    # -------------------------------------------------------------------------
    # Step 2: Search Papers (for each keyword)
    # -------------------------------------------------------------------------
    yield create_log("search", "start", f"Starting paper search for {len(search_queries)} queries...")

    # Calculate results per query to stay within limits
    results_per_query = max(1, max_results // len(search_queries))

    for query_idx, search_query in enumerate(search_queries):
        yield create_log(
            "search", "progress",
            f"Searching query {query_idx + 1}/{len(search_queries)}: \"{search_query}\""
        )

        # Search each source for this query
        if "arxiv" in sources:
            try:
                arxiv_papers = search_arxiv(search_query, results_per_query)
                all_papers.extend(arxiv_papers)
                if arxiv_papers:
                    yield create_log("search", "progress", f"  arXiv: {len(arxiv_papers)} papers")
            except Exception as e:
                yield create_log("search", "error", f"  arXiv failed: {str(e)}")

        if "semantic-scholar" in sources:
            try:
                s2_papers = search_semantic_scholar(search_query, results_per_query)
                all_papers.extend(s2_papers)
                if s2_papers:
                    yield create_log("search", "progress", f"  Semantic Scholar: {len(s2_papers)} papers")
            except Exception as e:
                yield create_log("search", "error", f"  Semantic Scholar failed: {str(e)}")

        if "openalex" in sources:
            try:
                oa_papers = search_openalex(search_query, results_per_query)
                all_papers.extend(oa_papers)
                if oa_papers:
                    yield create_log("search", "progress", f"  OpenAlex: {len(oa_papers)} papers")
            except Exception as e:
                yield create_log("search", "error", f"  OpenAlex failed: {str(e)}")

        # Small delay between queries to avoid rate limiting
        if query_idx < len(search_queries) - 1:
            time.sleep(0.5)

    # Deduplicate
    unique_papers = deduplicate_papers(all_papers)
    yield create_log(
        "search", "complete",
        f"Found {len(all_papers)} total, deduplicated to {len(unique_papers)} unique papers",
        {"paperCount": len(unique_papers), "totalFound": len(all_papers)}
    )

    if not unique_papers:
        yield create_log("search", "error", "No papers found. Try a different query.")
        return

    # -------------------------------------------------------------------------
    # Step 2: Analyze Market Viability (moved before extraction for auto-filter)
    # -------------------------------------------------------------------------
    if not skip_viability:
        yield create_log("viability", "start", f"Analyzing market viability (0/{len(unique_papers)})...")

        for i, paper in enumerate(unique_papers):
            if (i + 1) % 10 == 0 or i == len(unique_papers) - 1:
                yield create_log(
                    "viability", "progress",
                    f"Analyzing market viability ({i + 1}/{len(unique_papers)})..."
                )

            scores = analyze_viability(paper)
            viability_scores[paper["id"]] = scores

            # Small delay to avoid rate limiting
            time.sleep(0.1)

        yield create_log(
            "viability", "complete",
            f"Completed viability analysis for {len(unique_papers)} papers"
        )
    else:
        yield create_log("viability", "complete", "Skipped viability analysis")

    # -------------------------------------------------------------------------
    # Auto-filter: Filter papers by viability score (Auto Mode only)
    # -------------------------------------------------------------------------
    papers_to_process = unique_papers  # Default: process all papers

    if auto_mode and not skip_viability and viability_scores:
        # Filter papers with aggregate viability score > threshold
        filtered_papers = []
        for paper in unique_papers:
            scores = viability_scores.get(paper["id"], {})
            if scores:
                aggregate = (
                    scores.get("novelty", 0) +
                    scores.get("marketSize", 0) +
                    scores.get("feasibility", 0) +
                    scores.get("timing", 0)
                ) / 4
                if aggregate > viability_threshold:
                    filtered_papers.append(paper)

        yield create_log(
            "viability", "progress",
            f"Auto-filter: {len(filtered_papers)} of {len(unique_papers)} papers have viability > {viability_threshold}"
        )
        papers_to_process = filtered_papers

        if not papers_to_process:
            yield create_log("viability", "error", f"No papers passed the viability threshold ({viability_threshold})")
            return

    # -------------------------------------------------------------------------
    # Step 3: Extract Researchers
    # -------------------------------------------------------------------------
    yield create_log("extract", "start", f"Extracting researchers from {len(papers_to_process)} papers...")

    researchers, authorship_links = extract_researchers(papers_to_process)

    yield create_log(
        "extract", "complete",
        f"Found {len(researchers)} unique researchers",
        {"researcherCount": len(researchers)}
    )

    # -------------------------------------------------------------------------
    # Step 4: Enrich Researchers
    # -------------------------------------------------------------------------
    enriched_count = 0
    not_found_count = 0

    if not skip_enrichment:
        # Apply researcher limit if set
        researchers_to_enrich = researchers
        if max_researchers > 0 and len(researchers) > max_researchers:
            researchers_to_enrich = researchers[:max_researchers]
            yield create_log(
                "enrich", "start",
                f"Enriching {len(researchers_to_enrich)} of {len(researchers)} researchers (limit: {max_researchers})..."
            )
        else:
            yield create_log("enrich", "start", f"Enriching {len(researchers_to_enrich)} researchers...")

        for i, researcher in enumerate(researchers_to_enrich):
            yield create_log(
                "enrich", "progress",
                f"[{i + 1}/{len(researchers_to_enrich)}] Enriching: {researcher['name']}..."
            )

            result = enrich_researcher(researcher["name"])

            if result.get("found"):
                researcher["email"] = result.get("email")
                researcher["lab"] = result.get("lab")
                researcher["institution"] = result.get("institution")
                researcher["country"] = result.get("country")
                researcher["enrichedAt"] = datetime.utcnow().isoformat()
                enriched_count += 1

                # Log detailed enrichment results
                found_fields = []
                if result.get("email"):
                    found_fields.append(f"email: {result.get('email')}")
                if result.get("institution"):
                    found_fields.append(f"institution: {result.get('institution')}")
                if result.get("lab"):
                    found_fields.append(f"lab: {result.get('lab')}")
                if result.get("country"):
                    found_fields.append(f"country: {result.get('country')}")

                if found_fields:
                    yield create_log(
                        "enrich", "progress",
                        f"  ✓ Found: {', '.join(found_fields)}"
                    )
                else:
                    yield create_log(
                        "enrich", "progress",
                        f"  ✓ Found but no contact details available"
                    )
            else:
                not_found_count += 1
                error_msg = result.get("error", "Not found")
                yield create_log(
                    "enrich", "progress",
                    f"  ✗ Not found: {error_msg}"
                )

            # Delay to avoid rate limiting
            time.sleep(0.5)

        yield create_log(
            "enrich", "complete",
            f"Enriched {enriched_count}/{len(researchers_to_enrich)} researchers ({not_found_count} not found)",
            {"enrichedCount": enriched_count, "notFoundCount": not_found_count}
        )
    else:
        yield create_log("enrich", "complete", "Skipped researcher enrichment")

    # -------------------------------------------------------------------------
    # Step 5: Compute Aggregate Viability
    # -------------------------------------------------------------------------
    yield create_log("aggregate", "start", "Computing viability aggregates...")

    for researcher in researchers:
        aggregate = compute_aggregate_viability(
            researcher["id"],
            authorship_links,
            papers_to_process,
            viability_scores
        )
        researcher["aggregateViability"] = aggregate

    yield create_log(
        "aggregate", "complete",
        f"Computed aggregates for {len(researchers)} researchers"
    )

    # -------------------------------------------------------------------------
    # Step 6: Save to Database
    # -------------------------------------------------------------------------
    yield create_log("save", "start", "Saving to database...")

    try:
        # Mark processed papers as flagged and embed viability scores
        processed_ids = {p["id"] for p in papers_to_process}
        new_papers = database.save_papers(
            papers_to_process,
            search_queries,
            viability_scores=viability_scores,
            flagged_ids=processed_ids if auto_mode else None
        )
        new_researchers, researcher_id_mapping = database.save_researchers(researchers)
        filtered_viability = {
            paper_id: scores
            for paper_id, scores in viability_scores.items()
            if paper_id in processed_ids
        }
        database.save_viability(filtered_viability)  # Keep for backward compatibility
        database.save_authorship(authorship_links, researcher_id_mapping)

        stats = database.get_stats()
        yield create_log(
            "save", "complete",
            "Pipeline complete!",
            {
                "papersTotal": stats["papers"],
                "researchersTotal": stats["researchers"],
                "newPapers": new_papers,
                "newResearchers": new_researchers,
            }
        )

    except Exception as e:
        yield create_log("save", "error", f"Failed to save: {str(e)}")


# =============================================================================
# HTTP Handler
# =============================================================================

def cors_headers(request: Request) -> dict:
    """Generate CORS headers."""
    origin = request.headers.get("Origin", "*")
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600",
    }


def get_auth_uid(request: Request) -> str | None:
    """
    Extract user UID from Authorization header.
    Returns None if not authenticated.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header[7:]  # Remove "Bearer " prefix


def check_quota(uid: str) -> dict:
    """
    Check if user can run pipeline via auth service.
    Returns quota info dict with 'allowed' boolean.
    """
    try:
        response = requests.get(
            f"{AUTH_API_URL}/email-auth-quota",
            headers={"Authorization": f"Bearer {uid}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return {"allowed": False, "error": "Failed to check quota"}
    except Exception as e:
        logging.error(f"Quota check failed: {e}")
        return {"allowed": False, "error": str(e)}


def increment_quota(uid: str) -> bool:
    """
    Increment user's pipeline run count via auth service.
    Returns True if successful.
    """
    try:
        response = requests.post(
            f"{AUTH_API_URL}/email-auth-quota",
            headers={"Authorization": f"Bearer {uid}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("success", False)
        return False
    except Exception as e:
        logging.error(f"Quota increment failed: {e}")
        return False


def require_auth_and_quota(request: Request) -> tuple[str | None, tuple | None]:
    """
    Check authentication and quota for a pipeline request.

    Returns:
        (uid, None) if authorized
        (None, error_response) if not authorized
    """
    uid = get_auth_uid(request)
    if not uid:
        return None, (
            json.dumps({"error": "Authentication required"}),
            401,
            {**cors_headers(request), "Content-Type": "application/json"}
        )

    quota = check_quota(uid)
    if not quota.get("allowed"):
        return None, (
            json.dumps({
                "error": "Pipeline quota exceeded",
                "quota": quota
            }),
            403,
            {**cors_headers(request), "Content-Type": "application/json"}
        )

    return uid, None


@functions_framework.http
def pipeline_runner(request: Request):
    """
    Run the research paper discovery pipeline.

    POST body:
    {
        "query": "search query",
        "sources": ["arxiv", "semantic-scholar", "openalex"],
        "maxResults": 20,
        "maxResearchers": 0,  // 0 = no limit
        "skipViability": false,
        "skipEnrichment": false,
        "skipExpansion": false,
        "numKeywords": 5,
        "apiKeys": {
            "gemini": "...",
            "openai": "...",
            "perplexity": "..."
        }
    }

    Response: Server-Sent Events stream of log entries
    """
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    # Check authentication and quota
    uid, error_response = require_auth_and_quota(request)
    if error_response:
        return error_response

    # Parse request
    try:
        request_json = request.get_json(silent=True) or {}
    except:
        request_json = {}

    query = request_json.get("query", "")
    sources = request_json.get("sources", ["arxiv", "semantic-scholar", "openalex"])
    max_results = min(100, max(1, request_json.get("maxResults", 20)))
    max_researchers = max(0, request_json.get("maxResearchers", 0))  # 0 = no limit
    skip_viability = request_json.get("skipViability", False)
    skip_enrichment = request_json.get("skipEnrichment", False)
    skip_expansion = request_json.get("skipExpansion", False)
    num_keywords = min(10, max(1, request_json.get("numKeywords", 5)))
    auto_mode = request_json.get("autoMode", False)
    viability_threshold = float(request_json.get("viabilityThreshold", 3.5))

    # Set API keys from request (allows frontend to pass keys from settings)
    api_keys = request_json.get("apiKeys", {})
    if api_keys.get("gemini"):
        os.environ["GEMINI_API_KEY"] = api_keys["gemini"]
    if api_keys.get("openai"):
        os.environ["OPENAI_API_KEY"] = api_keys["openai"]
    if api_keys.get("perplexity"):
        os.environ["PERPLEXITY_API_KEY"] = api_keys["perplexity"]

    if not query:
        return (
            json.dumps({"error": "Search query required"}),
            400,
            {**cors_headers(request), "Content-Type": "application/json"},
        )

    # Increment quota for this pipeline run (auto mode counts as 1 full run)
    increment_quota(uid)

    def generate():
        """Generator for SSE stream."""
        for log_entry in run_pipeline(
            query, sources, max_results, skip_viability, skip_enrichment,
            skip_expansion, num_keywords, max_researchers, auto_mode, viability_threshold
        ):
            yield log_entry

    headers = {
        **cors_headers(request),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return Response(generate(), mimetype="text/event-stream", headers=headers)


# =============================================================================
# Phase Endpoints (for Manual Mode)
# =============================================================================

@functions_framework.http
def pipeline_search(request: Request):
    """
    Run Phase 1: keyword expansion, paper search, and optional viability analysis.
    Returns papers ready for selection.

    POST body:
    {
        "query": "search query",
        "sources": ["arxiv", "semantic-scholar", "openalex"],
        "maxResults": 20,
        "skipViability": false,
        "skipExpansion": false,
        "numKeywords": 5,
        "apiKeys": { ... }
    }

    Response: Server-Sent Events stream ending with papers_ready event
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    # Check authentication and quota (but don't increment yet - wait for continue)
    uid, error_response = require_auth_and_quota(request)
    if error_response:
        return error_response

    try:
        request_json = request.get_json(silent=True) or {}
    except:
        request_json = {}

    query = request_json.get("query", "")
    sources = request_json.get("sources", ["arxiv", "semantic-scholar", "openalex"])
    max_results = min(100, max(1, request_json.get("maxResults", 20)))
    skip_viability = request_json.get("skipViability", False)
    skip_expansion = request_json.get("skipExpansion", False)
    num_keywords = min(10, max(1, request_json.get("numKeywords", 5)))

    # Set API keys from request
    api_keys = request_json.get("apiKeys", {})
    if api_keys.get("gemini"):
        os.environ["GEMINI_API_KEY"] = api_keys["gemini"]
    if api_keys.get("openai"):
        os.environ["OPENAI_API_KEY"] = api_keys["openai"]
    if api_keys.get("perplexity"):
        os.environ["PERPLEXITY_API_KEY"] = api_keys["perplexity"]

    if not query:
        return (
            json.dumps({"error": "Search query required"}),
            400,
            {**cors_headers(request), "Content-Type": "application/json"},
        )

    def generate():
        for log_entry in run_search_phase(
            query, sources, max_results, skip_viability, skip_expansion, num_keywords
        ):
            # Intercept papers_ready event to track session -> user mapping
            if '"type": "papers_ready"' in log_entry:
                try:
                    # Parse the SSE data to get session ID
                    data_str = log_entry.replace("data: ", "").strip()
                    data = json.loads(data_str)
                    session_id = data.get("sessionId")
                    if session_id:
                        _session_users[session_id] = uid
                except Exception:
                    pass
            yield log_entry

    headers = {
        **cors_headers(request),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return Response(generate(), mimetype="text/event-stream", headers=headers)


@functions_framework.http
def pipeline_continue(request: Request):
    """
    Run Phase 2: process selected papers only.
    Extracts researchers, enriches, aggregates, and saves.

    POST body:
    {
        "sessionId": "abc123",
        "selectedPapers": [...],  // Papers selected by user
        "keywords": [...],
        "viabilityScores": {...},
        "skipEnrichment": false,
        "maxResearchers": 10,
        "apiKeys": { ... }
    }

    Response: Server-Sent Events stream of log entries
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    # Check authentication
    uid = get_auth_uid(request)
    if not uid:
        return (
            json.dumps({"error": "Authentication required"}),
            401,
            {**cors_headers(request), "Content-Type": "application/json"}
        )

    try:
        request_json = request.get_json(silent=True) or {}
    except:
        request_json = {}

    session_id = request_json.get("sessionId", "")
    selected_papers = request_json.get("selectedPapers", [])
    keywords = request_json.get("keywords", [])
    viability_scores = request_json.get("viabilityScores", {})
    skip_enrichment = request_json.get("skipEnrichment", False)
    max_researchers = max(0, request_json.get("maxResearchers", 0))

    # Verify session belongs to this user (if we have tracking)
    if session_id in _session_users:
        if _session_users[session_id] != uid:
            return (
                json.dumps({"error": "Session does not belong to this user"}),
                403,
                {**cors_headers(request), "Content-Type": "application/json"}
            )

    # Check quota before proceeding
    quota = check_quota(uid)
    if not quota.get("allowed"):
        return (
            json.dumps({
                "error": "Pipeline quota exceeded",
                "quota": quota
            }),
            403,
            {**cors_headers(request), "Content-Type": "application/json"}
        )

    # Increment quota only if this session hasn't been counted yet
    # (search + continue = 1 combined run)
    if session_id not in _counted_sessions:
        increment_quota(uid)
        _counted_sessions.add(session_id)
        # Clean up session tracking
        if session_id in _session_users:
            del _session_users[session_id]

    # Set API keys from request
    api_keys = request_json.get("apiKeys", {})
    if api_keys.get("gemini"):
        os.environ["GEMINI_API_KEY"] = api_keys["gemini"]
    if api_keys.get("openai"):
        os.environ["OPENAI_API_KEY"] = api_keys["openai"]
    if api_keys.get("perplexity"):
        os.environ["PERPLEXITY_API_KEY"] = api_keys["perplexity"]

    if not selected_papers:
        return (
            json.dumps({"error": "No papers selected"}),
            400,
            {**cors_headers(request), "Content-Type": "application/json"},
        )

    def generate():
        for log_entry in run_processing_phase(
            session_id, selected_papers, keywords, viability_scores,
            skip_enrichment, max_researchers
        ):
            yield log_entry

    headers = {
        **cors_headers(request),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return Response(generate(), mimetype="text/event-stream", headers=headers)


# =============================================================================
# Additional Endpoints
# =============================================================================

@functions_framework.http
def pipeline_status(request: Request):
    """Get current database statistics."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        stats = database.get_stats()
        return (json_dumps({"success": True, **stats}), 200, headers)
    except Exception as e:
        return (json_dumps(error_payload("pipeline_status", e)), 500, headers)


@functions_framework.http
def get_researchers(request: Request):
    """Get all researchers with their associated papers."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        researchers = database.load_researchers_with_papers()
        return (json_dumps({"success": True, "researchers": researchers}), 200, headers)
    except Exception as e:
        return (json_dumps(error_payload("get_researchers", e)), 500, headers)


@functions_framework.http
def get_papers(request: Request):
    """Get all papers from database."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        papers = database.load_papers()
        return (json_dumps({"success": True, "papers": papers}), 200, headers)
    except Exception as e:
        return (json_dumps(error_payload("get_papers", e)), 500, headers)


@functions_framework.http
def dev_status(request: Request):
    """Check if DEV_MODE is enabled."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    dev_mode = os.environ.get("DEV_MODE", "").upper() == "TRUE"
    return (json.dumps({"success": True, "devMode": dev_mode}), 200, headers)


@functions_framework.http
def clear_database(request: Request):
    """Clear all data from the database. Only available in DEV_MODE."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    # Check if DEV_MODE is enabled
    dev_mode = os.environ.get("DEV_MODE", "").upper() == "TRUE"
    if not dev_mode:
        return (json.dumps({
            "success": False,
            "error": "This endpoint is only available in DEV_MODE"
        }), 403, headers)

    try:
        result = database.clear_all_data()
        return (json.dumps({
            "success": True,
            "message": "All data cleared",
            **result
        }), 200, headers)
    except Exception as e:
        return (json.dumps({"success": False, "error": str(e)}), 500, headers)


@functions_framework.http
def analyze_paper_viability(request: Request):
    """
    Analyze market viability for a single paper.

    POST body:
    {
        "paper": {
            "id": "...",
            "title": "...",
            "abstract": "..."
        },
        "apiKeys": {
            "gemini": "...",
            "openai": "..."
        }
    }

    Response:
    {
        "success": true,
        "paperId": "...",
        "viability": {
            "novelty": 4,
            "marketSize": 3,
            "feasibility": 5,
            "timing": 4,
            "analysis": "..."
        }
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        paper = request_json.get("paper")

        if not paper:
            return (json.dumps({
                "success": False,
                "error": "Paper data required"
            }), 400, headers)

        if not paper.get("title"):
            return (json.dumps({
                "success": False,
                "error": "Paper title required"
            }), 400, headers)

        # Set API keys from request
        api_keys = request_json.get("apiKeys", {})
        if api_keys.get("gemini"):
            os.environ["GEMINI_API_KEY"] = api_keys["gemini"]
        if api_keys.get("openai"):
            os.environ["OPENAI_API_KEY"] = api_keys["openai"]

        # Analyze viability
        viability = analyze_viability(paper)

        # Calculate aggregate score
        aggregate = (
            viability.get("novelty", 0) +
            viability.get("marketSize", 0) +
            viability.get("feasibility", 0) +
            viability.get("timing", 0)
        ) / 4
        viability["aggregate"] = round(aggregate, 2)

        return (json.dumps({
            "success": True,
            "paperId": paper.get("id"),
            "viability": viability
        }), 200, headers)

    except Exception as e:
        return (json.dumps({
            "success": False,
            "error": str(e)
        }), 500, headers)


@functions_framework.http
def save_papers(request: Request):
    """
    Save papers to the database. Useful for adding papers discovered outside the pipeline.

    POST body:
    {
        "papers": [
            {
                "id": "...",
                "title": "...",
                "abstract": "...",
                "authors": ["..."],
                "year": 2024,
                "doi": "...",
                "arxivId": "...",
                "source": "...",
                "citations": 0,
                "url": "...",
                "pdfUrl": "..."
            }
        ],
        "keywords": ["researcher-papers"]  // optional, defaults to ["imported"]
    }

    Response:
    {
        "success": true,
        "savedCount": 5,
        "message": "Saved 5 papers to database"
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        papers_data = request_json.get("papers", [])
        keywords = request_json.get("keywords", ["imported"])

        if not papers_data:
            return (json.dumps({
                "success": False,
                "error": "No papers provided"
            }), 400, headers)

        # Convert frontend format to backend format
        papers = []
        for p in papers_data:
            papers.append({
                "id": p.get("id", f"imported-{uuid.uuid4().hex[:12]}"),
                "title": p.get("title", ""),
                "abstract": p.get("abstract", ""),
                "authors": p.get("authors", []),
                "year": p.get("year"),
                "doi": p.get("doi"),
                "arxivId": p.get("arxivId"),
                "source": p.get("source", "imported"),
                "citations": p.get("citations"),
                "url": p.get("url"),
                "pdfUrl": p.get("pdfUrl"),
            })

        new_count = database.save_papers(papers, keywords)

        return (json.dumps({
            "success": True,
            "savedCount": new_count,
            "totalProvided": len(papers),
            "message": f"Saved {new_count} new papers to database"
        }), 200, headers)

    except Exception as e:
        return (json.dumps({
            "success": False,
            "error": str(e)
        }), 500, headers)


@functions_framework.http
def test_database(request: Request):
    """
    Test database connectivity by saving and deleting a paper.
    Only available in DEV_MODE.

    Steps:
    1. Search arXiv for 1 paper
    2. Save it to database
    3. Delete it
    4. Return success/failure
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    # Check if DEV_MODE is enabled
    dev_mode = os.environ.get("DEV_MODE", "").upper() == "TRUE"
    if not dev_mode:
        return (json.dumps({
            "success": False,
            "error": "This endpoint is only available in DEV_MODE"
        }), 403, headers)

    test_paper_id = None
    steps_completed = []

    try:
        # Step 1: Search arXiv for 1 paper
        papers = search_arxiv("machine learning", max_results=1)
        if not papers:
            return (json.dumps({
                "success": False,
                "error": "No papers found from arXiv"
            }), 500, headers)

        test_paper = papers[0]
        test_paper_id = test_paper["id"]
        steps_completed.append(f"Found paper: {test_paper['title'][:50]}...")

        # Step 2: Save to database
        new_count = database.save_papers([test_paper], ["__db_test__"])
        steps_completed.append(f"Saved paper to database (new: {new_count})")

        # Step 3: Verify it was saved
        stats_before = database.get_stats()
        steps_completed.append(f"Database has {stats_before['papers']} papers")

        # Step 4: Delete the test paper
        deleted = database.delete_paper(test_paper_id)
        if deleted:
            steps_completed.append("Successfully deleted test paper")
        else:
            steps_completed.append("Paper was not found for deletion (may have been duplicate)")

        # Step 5: Verify deletion
        stats_after = database.get_stats()
        steps_completed.append(f"Database now has {stats_after['papers']} papers")

        return (json.dumps({
            "success": True,
            "message": "Database test completed successfully",
            "steps": steps_completed,
            "paperTested": {
                "id": test_paper_id,
                "title": test_paper["title"],
            }
        }), 200, headers)

    except Exception as e:
        # Try to clean up if we created a paper
        if test_paper_id:
            try:
                database.delete_paper(test_paper_id)
            except:
                pass

        return (json.dumps({
            "success": False,
            "error": str(e),
            "steps": steps_completed,
        }), 500, headers)


# =============================================================================
# Paper Review Endpoints
# =============================================================================

@functions_framework.http
def update_paper_status(request: Request):
    """
    Update the review status of a paper.

    POST body:
    {
        "paperId": "...",
        "status": "saved" | "under_review" | "pass" | "pending",
        "passReason": "..." (optional, used when status is "pass")
    }

    Response:
    {
        "success": true,
        "paperId": "...",
        "status": "saved"
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        paper_id = request_json.get("paperId")
        status = request_json.get("status")
        pass_reason = request_json.get("passReason")

        if not paper_id:
            return (json.dumps({
                "success": False,
                "error": "Paper ID required"
            }), 400, headers)

        valid_statuses = {"pending", "saved", "under_review", "pass"}
        if status not in valid_statuses:
            return (json.dumps({
                "success": False,
                "error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            }), 400, headers)

        updated = database.update_paper_status(paper_id, status, pass_reason)

        if updated:
            return (json.dumps({
                "success": True,
                "paperId": paper_id,
                "status": status,
                "passReason": pass_reason
            }), 200, headers)
        else:
            return (json.dumps({
                "success": False,
                "error": "Paper not found"
            }), 404, headers)

    except Exception as e:
        return (json.dumps(error_payload("update_paper_status", e)), 500, headers)


@functions_framework.http
def get_papers_filtered(request: Request):
    """
    Get papers with filtering and sorting.

    Query params:
    - status: Filter by review status
    - location: Search by institution/country
    - sortBy: created_at, year, citations, viability_score
    - sortOrder: asc, desc

    Response:
    {
        "success": true,
        "papers": [...]
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        status = request.args.get("status")
        location = request.args.get("location")
        sort_by = request.args.get("sortBy", "created_at")
        sort_order = request.args.get("sortOrder", "desc")

        papers = database.get_papers_filtered(status, location, sort_by, sort_order)
        return (json_dumps({"success": True, "papers": papers}), 200, headers)

    except Exception as e:
        return (json_dumps(error_payload("get_papers_filtered", e)), 500, headers)


@functions_framework.http
def get_pass_reason_tags(request: Request):
    """
    Get all pass reason tags.

    Response:
    {
        "success": true,
        "tags": [{"id": 1, "name": "Not relevant", "createdAt": "..."}]
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        tags = database.get_pass_reason_tags()
        return (json.dumps({"success": True, "tags": tags}), 200, headers)

    except Exception as e:
        return (json.dumps(error_payload("get_pass_reason_tags", e)), 500, headers)


@functions_framework.http
def create_pass_reason_tag(request: Request):
    """
    Create a new pass reason tag.

    POST body:
    {
        "name": "Not relevant to our focus"
    }

    Response:
    {
        "success": true,
        "tag": {"id": 1, "name": "Not relevant to our focus", "createdAt": "..."}
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        name = request_json.get("name", "").strip()

        if not name:
            return (json.dumps({
                "success": False,
                "error": "Tag name required"
            }), 400, headers)

        if len(name) > 100:
            return (json.dumps({
                "success": False,
                "error": "Tag name must be 100 characters or less"
            }), 400, headers)

        tag = database.create_pass_reason_tag(name)

        if tag:
            return (json.dumps({"success": True, "tag": tag}), 201, headers)
        else:
            return (json.dumps({
                "success": False,
                "error": "Tag already exists"
            }), 409, headers)

    except Exception as e:
        return (json.dumps(error_payload("create_pass_reason_tag", e)), 500, headers)


@functions_framework.http
def generate_email(request: Request):
    """
    Generate outreach email for a researcher using Gemini.

    POST body:
    {
        "researcher": {
            "name": "Dr. Smith",
            "email": "smith@university.edu",
            "institution": "MIT",
            "lab": "AI Lab"
        },
        "paper": {
            "title": "...",
            "abstract": "..."
        },
        "purpose": "collaboration",  // optional: collaboration, inquiry, feedback
        "context": "Additional context..."  // optional
        "apiKeys": {
            "gemini": "..."
        }
    }

    Response:
    {
        "success": true,
        "email": {
            "subject": "...",
            "greeting": "Dear Dr. Smith,",
            "body": "...",
            "closing": "Best regards,"
        }
    }
    """
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        researcher = request_json.get("researcher", {})
        paper = request_json.get("paper", {})
        purpose = request_json.get("purpose", "collaboration")
        context = request_json.get("context", "")

        # Set API keys
        api_keys = request_json.get("apiKeys", {})
        if api_keys.get("gemini"):
            os.environ["GEMINI_API_KEY"] = api_keys["gemini"]

        if not researcher.get("name"):
            return (json.dumps({
                "success": False,
                "error": "Researcher name required"
            }), 400, headers)

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return (json.dumps({
                "success": False,
                "error": "Gemini API key required"
            }), 400, headers)

        # Build the prompt
        researcher_info = f"Name: {researcher.get('name')}"
        if researcher.get("institution"):
            researcher_info += f"\nInstitution: {researcher.get('institution')}"
        if researcher.get("lab"):
            researcher_info += f"\nLab/Department: {researcher.get('lab')}"

        paper_info = ""
        if paper.get("title"):
            paper_info = f"\nPaper Title: {paper.get('title')}"
            if paper.get("abstract"):
                paper_info += f"\nAbstract: {paper.get('abstract')[:500]}..."

        purpose_desc = {
            "collaboration": "proposing a research collaboration",
            "inquiry": "asking about their research",
            "feedback": "seeking feedback on related work",
            "licensing": "discussing potential technology licensing or commercialization"
        }.get(purpose, "professional outreach")

        prompt = f"""Write a professional outreach email to an academic researcher.

Researcher Information:
{researcher_info}

{paper_info}

Purpose: {purpose_desc}
{f'Additional Context: {context}' if context else ''}

Requirements:
- Professional but personable tone
- Reference their specific work if paper info is provided
- Clear purpose stated early
- Concise (2-3 short paragraphs)
- End with a specific call to action

Return ONLY a JSON object with keys: subject, greeting, body, closing
Example: {{"subject": "Collaboration Inquiry - [Topic]", "greeting": "Dear Dr. Smith,", "body": "...", "closing": "Best regards,"}}"""

        url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 1000,
                    "responseMimeType": "application/json",
                }
            },
            timeout=30,
        )
        response.raise_for_status()

        result = response.json()

        # Extract content from Gemini response
        if not result.get("candidates"):
            return (json.dumps({
                "success": False,
                "error": "No response from Gemini API"
            }), 500, headers)

        content = result["candidates"][0]["content"]["parts"][0]["text"]

        # Try to parse JSON from content (may be wrapped in markdown code blocks)
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        email_data = json.loads(content)

        # Validate required fields
        required_fields = ["subject", "greeting", "body", "closing"]
        for field in required_fields:
            if field not in email_data:
                email_data[field] = ""

        return (json.dumps({
            "success": True,
            "email": email_data
        }), 200, headers)

    except requests.exceptions.RequestException as e:
        return (json.dumps({
            "success": False,
            "error": f"API request failed: {str(e)}"
        }), 500, headers)
    except json.JSONDecodeError as e:
        return (json.dumps({
            "success": False,
            "error": f"Failed to parse AI response: {str(e)}"
        }), 500, headers)
    except Exception as e:
        return (json.dumps(error_payload("generate_email", e)), 500, headers)


# =============================================================================
# Router (for local development)
# =============================================================================

@functions_framework.http
def main_handler(request: Request):
    """
    Main router that dispatches to the appropriate handler based on URL path.

    Use this as the target when running locally:
    functions-framework --target=main_handler --port=8081

    Routes:
    - /pipeline-runner or / (POST) -> pipeline_runner
    - /pipeline-status (GET) -> pipeline_status
    - /get-researchers (GET) -> get_researchers
    - /get-papers (GET) -> get_papers
    """
    path = request.path.rstrip("/")

    # Handle CORS preflight for all routes
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))

    # Route to appropriate handler
    if path in ("", "/pipeline-runner"):
        return pipeline_runner(request)
    elif path == "/pipeline-search":
        return pipeline_search(request)
    elif path == "/pipeline-continue":
        return pipeline_continue(request)
    elif path == "/pipeline-status":
        return pipeline_status(request)
    elif path == "/get-researchers":
        return get_researchers(request)
    elif path == "/get-papers":
        return get_papers(request)
    elif path == "/dev-status":
        return dev_status(request)
    elif path == "/clear-database":
        return clear_database(request)
    elif path == "/test-database":
        return test_database(request)
    elif path == "/save-papers":
        return save_papers(request)
    elif path == "/analyze-viability":
        return analyze_paper_viability(request)
    elif path == "/update-paper-status":
        return update_paper_status(request)
    elif path == "/get-papers-filtered":
        return get_papers_filtered(request)
    elif path == "/get-pass-reason-tags":
        return get_pass_reason_tags(request)
    elif path == "/create-pass-reason-tag":
        return create_pass_reason_tag(request)
    elif path == "/generate-email":
        return generate_email(request)
    else:
        headers = {**cors_headers(request), "Content-Type": "application/json"}
        return (json.dumps({"error": f"Unknown route: {path}"}), 404, headers)
