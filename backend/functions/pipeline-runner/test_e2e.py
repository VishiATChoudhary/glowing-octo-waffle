#!/usr/bin/env python3
"""
End-to-End Test for Pipeline Runner

This script tests the complete pipeline flow:
1. Sends a search request to the pipeline
2. Receives and validates SSE log stream
3. Verifies data is saved to local storage

Usage:
    # First, start the server in another terminal:
    # cd backend/functions/pipeline-runner
    # pip install -r requirements.txt
    # functions-framework --target=pipeline_runner --port=8081

    # Then run this test:
    python test_e2e.py

    # Or run with a custom query:
    python test_e2e.py --query "solid state batteries"
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests

# Configuration
DEFAULT_BASE_URL = "http://localhost:8081"
DEFAULT_QUERY = "graphene supercapacitors"
DEFAULT_MAX_RESULTS = 5  # Small for faster testing

# Colors for terminal output
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str):
    print(f"{Colors.CYAN}ℹ {text}{Colors.RESET}")


def print_log(step: str, message: str, status: str):
    color = {
        "start": Colors.YELLOW,
        "progress": Colors.CYAN,
        "complete": Colors.GREEN,
        "error": Colors.RED,
    }.get(status, Colors.RESET)
    print(f"  {color}[{step}]{Colors.RESET} {message}")


def test_server_health(base_url: str) -> bool:
    """Test if the server is running."""
    print_header("Test 1: Server Health Check")

    try:
        # Try to connect to the server
        response = requests.options(f"{base_url}/pipeline-runner", timeout=5)
        print_success(f"Server is running at {base_url}")
        return True
    except requests.exceptions.ConnectionError:
        print_error(f"Cannot connect to server at {base_url}")
        print_info("Make sure to start the server first:")
        print_info("  cd backend/functions/pipeline-runner")
        print_info("  functions-framework --target=pipeline_runner --port=8081")
        return False
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        return False


def test_pipeline_run(base_url: str, query: str, max_results: int, with_expansion: bool = False) -> dict:
    """Run the pipeline and collect results."""
    print_header("Test 2: Pipeline Execution")

    print_info(f"Query: '{query}'")
    print_info(f"Max results per source: {max_results}")
    print_info("Sources: arXiv, Semantic Scholar, OpenAlex")
    print()

    # Prepare request
    payload = {
        "query": query,
        "sources": ["arxiv", "semantic-scholar", "openalex"],
        "maxResults": max_results,
        "skipViability": True,  # Skip for faster testing (requires OpenAI key)
        "skipEnrichment": True,  # Skip for faster testing (requires Perplexity key)
        "skipExpansion": not with_expansion,  # Enable with --with-expansion flag
        "numKeywords": 3,
    }

    if with_expansion:
        print_info("Keyword expansion ENABLED (requires OPENAI_API_KEY)")
    else:
        print_info("Keyword expansion disabled (use --with-expansion to enable)")

    logs = []
    steps_seen = set()
    errors = []
    final_data = {}

    try:
        print_info("Starting pipeline (streaming logs)...")
        print()

        # Make streaming request
        response = requests.post(
            f"{base_url}/pipeline-runner",
            json=payload,
            headers={"Content-Type": "application/json"},
            stream=True,
            timeout=120,
        )

        if not response.ok:
            print_error(f"Request failed: {response.status_code} - {response.text}")
            return {"success": False, "error": f"HTTP {response.status_code}"}

        # Process SSE stream
        buffer = ""
        for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                buffer += chunk

                # Process complete lines
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)

                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            logs.append(data)
                            steps_seen.add(data.get("step"))

                            # Print log
                            print_log(
                                data.get("step", "?"),
                                data.get("message", ""),
                                data.get("status", "")
                            )

                            # Track errors (but ignore rate limit errors in search phase)
                            if data.get("status") == "error":
                                msg = data.get("message", "")
                                # Rate limit errors during search are expected without API keys
                                if data.get("step") == "search" and ("429" in msg or "rate" in msg.lower()):
                                    pass  # Ignore rate limit errors
                                else:
                                    errors.append(msg)

                            # Capture final data
                            if data.get("step") == "save" and data.get("data"):
                                final_data = data.get("data")

                        except json.JSONDecodeError:
                            pass

        print()

        # Validate results
        expected_steps = {"expand", "search", "extract", "viability", "enrich", "aggregate", "save"}
        missing_steps = expected_steps - steps_seen

        if missing_steps:
            print_error(f"Missing pipeline steps: {missing_steps}")
        else:
            print_success("All pipeline steps executed")

        if errors:
            for error in errors:
                print_error(f"Pipeline error: {error}")
        else:
            print_success("No errors during pipeline execution")

        print_success(f"Received {len(logs)} log entries")

        return {
            "success": len(errors) == 0 and not missing_steps,
            "logs": logs,
            "steps_seen": list(steps_seen),
            "errors": errors,
            "final_data": final_data,
        }

    except requests.exceptions.Timeout:
        print_error("Request timed out")
        return {"success": False, "error": "Timeout"}
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        return {"success": False, "error": str(e)}


def test_storage_files() -> dict:
    """Verify that data was saved to local storage."""
    print_header("Test 3: Local Storage Verification")

    data_dir = Path(__file__).parent / "data"

    if not data_dir.exists():
        print_error(f"Data directory not found: {data_dir}")
        return {"success": False}

    print_success(f"Data directory exists: {data_dir}")

    files = {
        "papers.json": [],
        "researchers.json": [],
        "viability.json": {},
        "authorship.json": [],
    }

    results = {}
    all_valid = True

    for filename, default in files.items():
        filepath = data_dir / filename

        if not filepath.exists():
            print_error(f"File not found: {filename}")
            all_valid = False
            continue

        try:
            with open(filepath, "r") as f:
                data = json.load(f)

            count = len(data) if isinstance(data, list) else len(data.keys())
            results[filename] = count
            print_success(f"{filename}: {count} entries")

        except json.JSONDecodeError as e:
            print_error(f"Invalid JSON in {filename}: {e}")
            all_valid = False
        except Exception as e:
            print_error(f"Error reading {filename}: {e}")
            all_valid = False

    return {"success": all_valid, "counts": results}


def test_data_integrity() -> dict:
    """Verify data integrity and relationships."""
    print_header("Test 4: Data Integrity Check")

    data_dir = Path(__file__).parent / "data"

    try:
        # Load all data
        with open(data_dir / "papers.json") as f:
            papers = json.load(f)
        with open(data_dir / "researchers.json") as f:
            researchers = json.load(f)
        with open(data_dir / "authorship.json") as f:
            authorship = json.load(f)

        # Create lookup sets
        paper_ids = {p["id"] for p in papers}
        researcher_ids = {r["id"] for r in researchers}

        # Validate authorship links
        invalid_paper_refs = 0
        invalid_researcher_refs = 0

        for link in authorship:
            if link["paperId"] not in paper_ids:
                invalid_paper_refs += 1
            if link["researcherId"] not in researcher_ids:
                invalid_researcher_refs += 1

        if invalid_paper_refs == 0:
            print_success("All authorship links reference valid papers")
        else:
            print_error(f"{invalid_paper_refs} authorship links reference invalid papers")

        if invalid_researcher_refs == 0:
            print_success("All authorship links reference valid researchers")
        else:
            print_error(f"{invalid_researcher_refs} authorship links reference invalid researchers")

        # Check paper structure
        required_paper_fields = {"id", "title", "authors", "source"}
        papers_with_missing_fields = 0

        for paper in papers:
            missing = required_paper_fields - set(paper.keys())
            if missing:
                papers_with_missing_fields += 1

        if papers_with_missing_fields == 0:
            print_success("All papers have required fields")
        else:
            print_error(f"{papers_with_missing_fields} papers have missing fields")

        # Check researcher structure
        required_researcher_fields = {"id", "name"}
        researchers_with_missing_fields = 0

        for researcher in researchers:
            missing = required_researcher_fields - set(researcher.keys())
            if missing:
                researchers_with_missing_fields += 1

        if researchers_with_missing_fields == 0:
            print_success("All researchers have required fields")
        else:
            print_error(f"{researchers_with_missing_fields} researchers have missing fields")

        # Summary stats
        print()
        print_info(f"Total papers: {len(papers)}")
        print_info(f"Total researchers: {len(researchers)}")
        print_info(f"Total authorship links: {len(authorship)}")

        # Show sample paper
        if papers:
            print()
            print_info("Sample paper:")
            sample = papers[0]
            print(f"    Title: {sample.get('title', 'N/A')[:60]}...")
            print(f"    Source: {sample.get('source', 'N/A')}")
            print(f"    Authors: {len(sample.get('authors', []))} authors")

        # Show sample researcher
        if researchers:
            print()
            print_info("Sample researcher:")
            sample = researchers[0]
            print(f"    Name: {sample.get('name', 'N/A')}")
            print(f"    Institution: {sample.get('institution') or 'Not enriched'}")

        success = (
            invalid_paper_refs == 0 and
            invalid_researcher_refs == 0 and
            papers_with_missing_fields == 0 and
            researchers_with_missing_fields == 0
        )

        return {"success": success}

    except FileNotFoundError as e:
        print_error(f"Data file not found: {e}")
        return {"success": False}
    except Exception as e:
        print_error(f"Error during integrity check: {e}")
        return {"success": False}


def run_all_tests(base_url: str, query: str, max_results: int, with_expansion: bool = False) -> bool:
    """Run all tests and return overall success."""
    print(f"\n{Colors.BOLD}Pipeline Runner End-to-End Tests{Colors.RESET}")
    print(f"Base URL: {base_url}")
    print(f"Query: {query}")

    results = {}

    # Test 1: Server health
    results["server_health"] = test_server_health(base_url)
    if not results["server_health"]:
        print_header("Tests Aborted")
        print_error("Server is not running. Please start the server and try again.")
        return False

    # Test 2: Pipeline run
    pipeline_result = test_pipeline_run(base_url, query, max_results, with_expansion)
    results["pipeline_run"] = pipeline_result.get("success", False)

    # Test 3: Storage files
    storage_result = test_storage_files()
    results["storage_files"] = storage_result.get("success", False)

    # Test 4: Data integrity
    integrity_result = test_data_integrity()
    results["data_integrity"] = integrity_result.get("success", False)

    # Summary
    print_header("Test Summary")

    all_passed = True
    for test_name, passed in results.items():
        if passed:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
            all_passed = False

    print()
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}All tests passed!{Colors.RESET}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}Some tests failed.{Colors.RESET}")

    return all_passed


def main():
    parser = argparse.ArgumentParser(description="Pipeline Runner E2E Tests")
    parser.add_argument(
        "--url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL of the pipeline server (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--query",
        default=DEFAULT_QUERY,
        help=f"Search query to test (default: {DEFAULT_QUERY})",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=DEFAULT_MAX_RESULTS,
        help=f"Max results per source (default: {DEFAULT_MAX_RESULTS})",
    )
    parser.add_argument(
        "--with-expansion",
        action="store_true",
        help="Enable keyword expansion (requires OPENAI_API_KEY)",
    )

    args = parser.parse_args()

    success = run_all_tests(args.url, args.query, args.max_results, args.with_expansion)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
