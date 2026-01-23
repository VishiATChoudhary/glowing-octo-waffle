"""
Perplexity Researcher Enrichment Cloud Function.
Uses Perplexity API with structured JSON output to find researcher email and lab/institution.
"""

import json
import os

import functions_framework
import requests
from flask import Request

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
PERPLEXITY_MODEL = "sonar-pro"


def cors_headers(request: Request) -> dict:
    """Generate CORS headers."""
    origin = request.headers.get("Origin", "*")
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600",
    }


def handle_cors(request: Request):
    """Handle CORS preflight."""
    if request.method == "OPTIONS":
        return ("", 204, cors_headers(request))
    return None


def get_perplexity_api_key() -> str:
    """Get Perplexity API key from environment."""
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY must be set")
    return api_key


def call_perplexity_api(name: str, affiliation: str | None = None) -> dict:
    """
    Call Perplexity API with structured JSON output.
    Returns parsed JSON result with email, lab, and institution.
    """
    api_key = get_perplexity_api_key()

    # Build the query prompt
    if affiliation:
        prompt = f"""Find the professional contact information for the academic researcher named {name} who is affiliated with {affiliation}.

Search for their:
1. Institutional/academic email address
2. Current research lab, department, or research group name
3. Current university or institution name
4. Country where they are based

Return accurate information only. If you cannot find specific information, leave it null."""
    else:
        prompt = f"""Find the professional contact information for the academic researcher named {name}.

Search for their:
1. Institutional/academic email address
2. Current research lab, department, or research group name
3. Current university or institution name
4. Country where they are based

Return accurate information only. If you cannot find specific information, leave it null."""

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
                    "content": "You are a research assistant that finds academic researcher contact information. Provide accurate, factual information only. If you cannot find specific information, return null for that field.",
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "email": {
                                "type": "string",
                                "description": "Institutional email address",
                            },
                            "lab": {
                                "type": "string",
                                "description": "Research lab or group name",
                            },
                            "institution": {
                                "type": "string",
                                "description": "University or institution name",
                            },
                            "country": {
                                "type": "string",
                                "description": "Country where the researcher is based",
                            },
                            "found": {
                                "type": "boolean",
                                "description": "Whether the researcher was found",
                            },
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

    if not response.ok:
        raise Exception(
            f"Perplexity API error: {response.status_code} - {response.text}"
        )

    api_response = response.json()
    content = api_response.get("choices", [{}])[0].get("message", {}).get("content", "")

    # Parse the structured JSON response
    return json.loads(content)


@functions_framework.http
def perplexity_enrich(request: Request):
    """
    Enrich researcher data using Perplexity API.

    Request body:
    {
        "name": "John Smith",
        "affiliation": "MIT" (optional)
    }

    Response:
    {
        "success": true,
        "email": "jsmith@mit.edu" or null,
        "lab": "AI Research Lab" or null,
        "institution": "Massachusetts Institute of Technology" or null,
        "country": "United States" or null,
        "found": true
    }
    """
    # Handle CORS
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        # Parse request
        request_json = request.get_json(silent=True)
        if not request_json:
            return (json.dumps({"error": "Request body required"}), 400, headers)

        name = request_json.get("name")
        if not name:
            return (json.dumps({"error": "Researcher name required"}), 400, headers)

        affiliation = request_json.get("affiliation")

        # Call Perplexity API
        result = call_perplexity_api(name, affiliation)

        return (
            json.dumps(
                {
                    "success": True,
                    "email": result.get("email"),
                    "lab": result.get("lab"),
                    "institution": result.get("institution"),
                    "country": result.get("country"),
                    "found": result.get("found", False),
                }
            ),
            200,
            headers,
        )

    except Exception as e:
        return (
            json.dumps(
                {
                    "success": False,
                    "error": str(e),
                }
            ),
            500,
            headers,
        )
