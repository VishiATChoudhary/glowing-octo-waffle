"""
Local Storage Module for Pipeline Runner

Handles CRUD operations for papers, researchers, viability scores,
and authorship links using local JSON files.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

# Data directory relative to this file
DATA_DIR = Path(__file__).parent / "data"


def ensure_data_dir():
    """Ensure data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_json(filename: str) -> list | dict:
    """Load JSON file, return empty list/dict if not exists."""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return [] if filename != "viability.json" else {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(filename: str, data: list | dict) -> None:
    """Save data to JSON file."""
    ensure_data_dir()
    filepath = DATA_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


# =============================================================================
# Papers
# =============================================================================

def load_papers() -> list[dict]:
    """Load all papers from storage."""
    return _load_json("papers.json")


def save_papers(papers: list[dict]) -> None:
    """Save papers to storage, merging with existing data."""
    existing = {p["id"]: p for p in load_papers()}

    for paper in papers:
        if "createdAt" not in paper:
            paper["createdAt"] = datetime.utcnow().isoformat()
        existing[paper["id"]] = paper

    _save_json("papers.json", list(existing.values()))


def get_paper(paper_id: str) -> Optional[dict]:
    """Get a single paper by ID."""
    papers = load_papers()
    for paper in papers:
        if paper["id"] == paper_id:
            return paper
    return None


# =============================================================================
# Researchers
# =============================================================================

def load_researchers() -> list[dict]:
    """Load all researchers from storage."""
    return _load_json("researchers.json")


def save_researchers(researchers: list[dict]) -> None:
    """Save researchers to storage, merging with existing data."""
    existing = {r["id"]: r for r in load_researchers()}

    for researcher in researchers:
        if researcher["id"] in existing:
            # Merge - keep existing data, update with new
            merged = {**existing[researcher["id"]], **researcher}
            existing[researcher["id"]] = merged
        else:
            existing[researcher["id"]] = researcher

    _save_json("researchers.json", list(existing.values()))


def get_researcher(researcher_id: str) -> Optional[dict]:
    """Get a single researcher by ID."""
    researchers = load_researchers()
    for researcher in researchers:
        if researcher["id"] == researcher_id:
            return researcher
    return None


def get_researcher_by_name(name: str) -> Optional[dict]:
    """Get a researcher by name (case-insensitive)."""
    researchers = load_researchers()
    name_lower = name.lower().strip()
    for researcher in researchers:
        if researcher.get("name", "").lower().strip() == name_lower:
            return researcher
    return None


# =============================================================================
# Viability Scores
# =============================================================================

def load_viability() -> dict:
    """Load viability scores (paper_id -> scores)."""
    return _load_json("viability.json")


def save_viability(viability: dict) -> None:
    """Save viability scores, merging with existing."""
    existing = load_viability()
    existing.update(viability)
    _save_json("viability.json", existing)


def get_viability(paper_id: str) -> Optional[dict]:
    """Get viability score for a paper."""
    viability = load_viability()
    return viability.get(paper_id)


# =============================================================================
# Authorship Links
# =============================================================================

def load_authorship() -> list[dict]:
    """Load authorship links (paper <-> researcher relationships)."""
    return _load_json("authorship.json")


def save_authorship(links: list[dict]) -> None:
    """Save authorship links, avoiding duplicates."""
    existing = load_authorship()

    # Create set of existing links for deduplication
    existing_set = {
        (link["paperId"], link["researcherId"])
        for link in existing
    }

    for link in links:
        key = (link["paperId"], link["researcherId"])
        if key not in existing_set:
            existing.append(link)
            existing_set.add(key)

    _save_json("authorship.json", existing)


def get_papers_by_researcher(researcher_id: str) -> list[str]:
    """Get all paper IDs for a researcher."""
    links = load_authorship()
    return [link["paperId"] for link in links if link["researcherId"] == researcher_id]


def get_researchers_by_paper(paper_id: str) -> list[str]:
    """Get all researcher IDs for a paper."""
    links = load_authorship()
    return [link["researcherId"] for link in links if link["paperId"] == paper_id]


# =============================================================================
# Utilities
# =============================================================================

def clear_all_data() -> None:
    """Clear all stored data (for testing)."""
    ensure_data_dir()
    for filename in ["papers.json", "researchers.json", "viability.json", "authorship.json"]:
        filepath = DATA_DIR / filename
        if filepath.exists():
            filepath.unlink()


def get_stats() -> dict:
    """Get storage statistics."""
    return {
        "papers": len(load_papers()),
        "researchers": len(load_researchers()),
        "viability_scores": len(load_viability()),
        "authorship_links": len(load_authorship()),
    }
