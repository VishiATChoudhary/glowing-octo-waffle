#!/usr/bin/env python3
"""
Integration Tests for Pipeline Runner

Tests the full pipeline flow with mocked external APIs.
Run with: pytest test_integration.py -v
"""

import json
import os
from unittest.mock import MagicMock, patch

import pytest

import storage
import main


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def temp_data_dir(tmp_path):
    """Create a temporary data directory for storage tests."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    # Patch storage.DATA_DIR to use temp directory
    original_data_dir = storage.DATA_DIR
    storage.DATA_DIR = data_dir

    yield data_dir

    # Restore original
    storage.DATA_DIR = original_data_dir


@pytest.fixture
def mock_arxiv_response():
    """Mock arXiv API response."""
    return """<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
            <id>http://arxiv.org/abs/2401.00001v1</id>
            <title>Solid State Battery Research</title>
            <summary>This paper presents advances in solid state batteries.</summary>
            <published>2024-01-15T00:00:00Z</published>
            <author><name>John Smith</name></author>
            <author><name>Jane Doe</name></author>
            <link title="pdf" href="http://arxiv.org/pdf/2401.00001v1"/>
        </entry>
        <entry>
            <id>http://arxiv.org/abs/2401.00002v1</id>
            <title>Electrolyte Materials Study</title>
            <summary>A comprehensive study of electrolyte materials.</summary>
            <published>2024-01-10T00:00:00Z</published>
            <author><name>Bob Wilson</name></author>
            <link title="pdf" href="http://arxiv.org/pdf/2401.00002v1"/>
        </entry>
    </feed>
    """


@pytest.fixture
def mock_s2_response():
    """Mock Semantic Scholar API response."""
    return {
        "data": [
            {
                "paperId": "abc123",
                "title": "Lithium Ion Conductors",
                "abstract": "Study of lithium ion conductors.",
                "year": 2024,
                "citationCount": 15,
                "authors": [{"name": "Jane Doe"}, {"name": "Alice Brown"}],
                "externalIds": {"DOI": "10.1234/example1"},
                "url": "https://semanticscholar.org/paper/abc123",
            }
        ]
    }


@pytest.fixture
def mock_openalex_response():
    """Mock OpenAlex API response."""
    return {
        "results": [
            {
                "id": "https://openalex.org/W123",
                "display_name": "Battery Technology Overview",
                "publication_year": 2024,
                "cited_by_count": 20,
                "authorships": [
                    {"author": {"display_name": "Charlie Davis"}},
                ],
                "abstract_inverted_index": {
                    "Overview": [0],
                    "of": [1],
                    "battery": [2],
                    "technology": [3],
                },
                "doi": "10.1234/example2",
            }
        ]
    }


@pytest.fixture
def mock_openai_keywords_response():
    """Mock OpenAI keyword expansion response."""
    return {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "keywords": [
                        "lithium solid electrolytes",
                        "all-solid-state batteries",
                        "ceramic ion conductors",
                    ]
                })
            }
        }]
    }


@pytest.fixture
def mock_openai_viability_response():
    """Mock OpenAI viability analysis response."""
    return {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "novelty": 4,
                    "marketSize": 5,
                    "feasibility": 3,
                    "timing": 4,
                    "analysis": "Promising technology with significant market potential.",
                })
            }
        }]
    }


@pytest.fixture
def mock_perplexity_response():
    """Mock Perplexity enrichment response."""
    return {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "email": "john.smith@mit.edu",
                    "lab": "Battery Research Lab",
                    "institution": "MIT",
                    "country": "United States",
                    "found": True,
                })
            }
        }]
    }


# =============================================================================
# Integration Tests
# =============================================================================

class TestPipelineIntegration:
    """Integration tests for the full pipeline."""

    @patch("main.requests.get")
    def test_search_arxiv_integration(self, mock_get, mock_arxiv_response):
        """Test arXiv search integration."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.text = mock_arxiv_response
        mock_get.return_value = mock_response

        papers = main.search_arxiv("solid state batteries", max_results=10)

        assert len(papers) == 2
        assert papers[0]["title"] == "Solid State Battery Research"
        assert papers[0]["source"] == "arXiv"
        assert "John Smith" in papers[0]["authors"]

    @patch("main.requests.get")
    def test_search_semantic_scholar_integration(self, mock_get, mock_s2_response):
        """Test Semantic Scholar search integration."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = mock_s2_response
        mock_get.return_value = mock_response

        papers = main.search_semantic_scholar("solid state batteries", max_results=10)

        assert len(papers) == 1
        assert papers[0]["title"] == "Lithium Ion Conductors"
        assert papers[0]["source"] == "Semantic Scholar"
        assert papers[0]["citations"] == 15

    @patch("main.requests.get")
    def test_search_openalex_integration(self, mock_get, mock_openalex_response):
        """Test OpenAlex search integration."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = mock_openalex_response
        mock_get.return_value = mock_response

        papers = main.search_openalex("solid state batteries", max_results=10)

        assert len(papers) == 1
        assert papers[0]["title"] == "Battery Technology Overview"
        assert papers[0]["source"] == "OpenAlex"
        # Check abstract reconstruction
        assert papers[0]["abstract"] == "Overview of battery technology"

    @patch("main.requests.get")
    @patch("main.requests.post")
    def test_full_pipeline_with_mocks(
        self,
        mock_post,
        mock_get,
        temp_data_dir,
        mock_arxiv_response,
        mock_s2_response,
        mock_openalex_response,
    ):
        """Test the full pipeline with all mocked APIs."""

        # Setup mock responses
        def mock_get_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()

            if "arxiv.org" in url:
                response.text = mock_arxiv_response
            elif "semanticscholar.org" in url:
                response.json.return_value = mock_s2_response
            elif "openalex.org" in url:
                response.json.return_value = mock_openalex_response

            return response

        mock_get.side_effect = mock_get_side_effect

        # Run pipeline (skip expansion, viability, and enrichment)
        logs = list(main.run_pipeline(
            query="solid state batteries",
            sources=["arxiv", "semantic-scholar", "openalex"],
            max_results=10,
            skip_viability=True,
            skip_enrichment=True,
            skip_expansion=True,
        ))

        # Verify logs
        log_steps = [json.loads(l[6:-2])["step"] for l in logs]
        assert "expand" in log_steps
        assert "search" in log_steps
        assert "extract" in log_steps
        assert "save" in log_steps

        # Verify data was saved
        papers = storage.load_papers()
        researchers = storage.load_researchers()
        authorship = storage.load_authorship()

        assert len(papers) > 0
        assert len(researchers) > 0
        assert len(authorship) > 0

    @patch("main.requests.get")
    @patch("main.requests.post")
    def test_pipeline_with_keyword_expansion(
        self,
        mock_post,
        mock_get,
        temp_data_dir,
        mock_arxiv_response,
        mock_openai_keywords_response,
    ):
        """Test pipeline with keyword expansion enabled."""

        def mock_get_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()
            response.text = mock_arxiv_response
            return response

        def mock_post_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()
            if "openai.com" in url:
                response.json.return_value = mock_openai_keywords_response
            return response

        mock_get.side_effect = mock_get_side_effect
        mock_post.side_effect = mock_post_side_effect

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            logs = list(main.run_pipeline(
                query="solid state batteries",
                sources=["arxiv"],
                max_results=10,
                skip_viability=True,
                skip_enrichment=True,
                skip_expansion=False,
                num_keywords=3,
            ))

        # Find the expand complete log
        expand_logs = [
            json.loads(l[6:-2])
            for l in logs
            if "expand" in l and "complete" in l
        ]

        assert len(expand_logs) > 0
        # Should have searched for multiple keywords
        search_logs = [l for l in logs if "search" in l.lower() and "query" in l.lower()]
        assert len(search_logs) > 1  # Original + expanded keywords

    @patch("main.requests.get")
    @patch("main.requests.post")
    def test_pipeline_with_viability_analysis(
        self,
        mock_post,
        mock_get,
        temp_data_dir,
        mock_arxiv_response,
        mock_openai_viability_response,
    ):
        """Test pipeline with viability analysis enabled."""

        def mock_get_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()
            response.text = mock_arxiv_response
            return response

        def mock_post_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()
            response.json.return_value = mock_openai_viability_response
            return response

        mock_get.side_effect = mock_get_side_effect
        mock_post.side_effect = mock_post_side_effect

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            logs = list(main.run_pipeline(
                query="solid state batteries",
                sources=["arxiv"],
                max_results=5,
                skip_viability=False,
                skip_enrichment=True,
                skip_expansion=True,
            ))

        # Verify viability was computed
        viability_logs = [l for l in logs if "viability" in l.lower()]
        assert len(viability_logs) > 0

        # Verify viability scores were saved
        viability = storage.load_viability()
        assert len(viability) > 0

        # Check score values
        for paper_id, scores in viability.items():
            assert scores["novelty"] == 4
            assert scores["marketSize"] == 5

    @patch("main.requests.get")
    @patch("main.requests.post")
    def test_pipeline_with_enrichment(
        self,
        mock_post,
        mock_get,
        temp_data_dir,
        mock_arxiv_response,
        mock_perplexity_response,
    ):
        """Test pipeline with researcher enrichment enabled."""

        def mock_get_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()
            response.text = mock_arxiv_response
            return response

        def mock_post_side_effect(url, **kwargs):
            response = MagicMock()
            response.raise_for_status = MagicMock()
            response.json.return_value = mock_perplexity_response
            return response

        mock_get.side_effect = mock_get_side_effect
        mock_post.side_effect = mock_post_side_effect

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "test-key"}):
            logs = list(main.run_pipeline(
                query="solid state batteries",
                sources=["arxiv"],
                max_results=5,
                skip_viability=True,
                skip_enrichment=False,
                skip_expansion=True,
            ))

        # Verify enrichment logs
        enrich_logs = [l for l in logs if "enrich" in l.lower()]
        assert len(enrich_logs) > 0

        # Verify researchers were enriched
        researchers = storage.load_researchers()
        enriched = [r for r in researchers if r.get("enrichedAt")]
        assert len(enriched) > 0

        # Check enrichment data
        enriched_researcher = enriched[0]
        assert enriched_researcher.get("email") == "john.smith@mit.edu"
        assert enriched_researcher.get("institution") == "MIT"
        assert enriched_researcher.get("country") == "United States"

    @patch("main.requests.get")
    def test_pipeline_handles_api_errors(self, mock_get, temp_data_dir, mock_openalex_response):
        """Test that pipeline handles API errors gracefully."""

        def mock_get_side_effect(url, **kwargs):
            if "arxiv.org" in url:
                raise Exception("arXiv API error")
            elif "semanticscholar.org" in url:
                response = MagicMock()
                response.raise_for_status.side_effect = Exception("S2 rate limit")
                return response
            else:
                # OpenAlex works - return some results so pipeline continues
                response = MagicMock()
                response.raise_for_status = MagicMock()
                response.json.return_value = mock_openalex_response
                return response

        mock_get.side_effect = mock_get_side_effect

        logs = list(main.run_pipeline(
            query="test",
            sources=["arxiv", "semantic-scholar", "openalex"],
            max_results=5,
            skip_viability=True,
            skip_enrichment=True,
            skip_expansion=True,
        ))

        # Check for error logs (arXiv should fail)
        error_logs = [l for l in logs if "error" in l.lower() and "arxiv" in l.lower()]
        assert len(error_logs) >= 1  # At least one arXiv error

        # Pipeline should still complete since OpenAlex returned results
        save_logs = [l for l in logs if "save" in l.lower()]
        assert len(save_logs) > 0

    @patch("main.requests.get")
    def test_pipeline_all_sources_fail(self, mock_get, temp_data_dir):
        """Test that pipeline exits gracefully when all sources fail."""

        def mock_get_side_effect(url, **kwargs):
            raise Exception("All APIs are down")

        mock_get.side_effect = mock_get_side_effect

        logs = list(main.run_pipeline(
            query="test",
            sources=["arxiv", "semantic-scholar", "openalex"],
            max_results=5,
            skip_viability=True,
            skip_enrichment=True,
            skip_expansion=True,
        ))

        # Check for error logs
        error_logs = [l for l in logs if "error" in l.lower()]
        assert len(error_logs) >= 1

        # Pipeline should have a "No papers found" error and not reach save
        log_text = " ".join(logs)
        assert "No papers found" in log_text or "0 unique papers" in log_text

    def test_pipeline_empty_query_handling(self, temp_data_dir):
        """Test that pipeline handles empty results gracefully."""
        with patch("main.search_arxiv", return_value=[]):
            with patch("main.search_semantic_scholar", return_value=[]):
                with patch("main.search_openalex", return_value=[]):
                    logs = list(main.run_pipeline(
                        query="xyznonexistent123",
                        sources=["arxiv", "semantic-scholar", "openalex"],
                        max_results=5,
                        skip_viability=True,
                        skip_enrichment=True,
                        skip_expansion=True,
                    ))

        # Should have an error about no papers found
        log_text = " ".join(logs)
        assert "No papers found" in log_text or "0 unique papers" in log_text


class TestPipelineSSEFormat:
    """Test SSE format compliance."""

    @patch("main.requests.get")
    def test_all_logs_are_valid_sse(self, mock_get, temp_data_dir, mock_arxiv_response):
        """Test that all log entries are valid SSE format."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.text = mock_arxiv_response
        mock_get.return_value = mock_response

        logs = list(main.run_pipeline(
            query="test",
            sources=["arxiv"],
            max_results=5,
            skip_viability=True,
            skip_enrichment=True,
            skip_expansion=True,
        ))

        for log in logs:
            # Check SSE format
            assert log.startswith("data: "), f"Log doesn't start with 'data: ': {log}"
            assert log.endswith("\n\n"), f"Log doesn't end with '\\n\\n': {log}"

            # Check valid JSON
            json_str = log[6:-2]
            data = json.loads(json_str)

            # Check required fields
            assert "timestamp" in data
            assert "step" in data
            assert "status" in data
            assert "message" in data

            # Check step is valid
            valid_steps = {"expand", "search", "extract", "viability", "enrich", "aggregate", "save"}
            assert data["step"] in valid_steps

            # Check status is valid
            valid_statuses = {"start", "progress", "complete", "error"}
            assert data["status"] in valid_statuses


# =============================================================================
# Run Tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
