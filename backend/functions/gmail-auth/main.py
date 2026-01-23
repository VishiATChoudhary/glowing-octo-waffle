"""
Gmail OAuth Cloud Functions.
Handles OAuth flow initiation and token exchange.
"""

import json
import secrets
import hashlib
import base64
from urllib.parse import urlencode
from typing import Optional, Dict, Any

import functions_framework
import requests
from flask import Request
from google.cloud import firestore

from token_manager import (
    get_client_credentials,
    generate_uid,
    store_tokens,
    get_user_by_email,
    delete_tokens,
    get_tokens,
)

PROJECT_ID = "waffle-mm"
USERS_COLLECTION = "users"
WHITELIST_COLLECTION = "whitelist"


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


# ============================================================================
# Whitelist Functions
# ============================================================================

def get_whitelist_entry(email: str) -> Optional[Dict[str, Any]]:
    """Check if email is in the whitelist."""
    db = get_firestore_client()
    email_lower = email.lower()
    docs = db.collection(WHITELIST_COLLECTION).where("email", "==", email_lower).limit(1).stream()
    for doc in docs:
        return doc.to_dict()
    return None


def is_email_whitelisted(email: str) -> bool:
    """Check if email is in the whitelist."""
    return get_whitelist_entry(email) is not None


def get_whitelisted_role(email: str) -> str:
    """Get the role assigned to a whitelisted email."""
    entry = get_whitelist_entry(email)
    if entry:
        return entry.get("role", "user")
    return "user"


# ============================================================================
# User Functions
# ============================================================================

def get_user_from_users_collection(email: str) -> Optional[Dict[str, Any]]:
    """Get user from users collection by email."""
    db = get_firestore_client()
    docs = db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).stream()
    for doc in docs:
        return doc.to_dict()
    return None


def create_or_update_google_user(
    uid: str,
    email: str,
    name: str,
    picture: Optional[str] = None,
    role: str = "user",
) -> Dict[str, Any]:
    """Create or update a user in the users collection from Google OAuth."""
    db = get_firestore_client()

    existing = get_user_from_users_collection(email)

    if existing:
        # Update existing user's last login
        db.collection(USERS_COLLECTION).document(existing["uid"]).update({
            "name": name,
            "picture": picture,
            "last_login": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        existing["name"] = name
        existing["picture"] = picture
        return existing

    # Create new Google user
    user_data = {
        "uid": uid,
        "email": email,
        "auth_provider": "google",
        "password_hash": None,
        "email_verified": True,
        "verification_token": None,
        "verification_token_expires": None,
        "reset_token": None,
        "reset_token_expires": None,
        "name": name,
        "picture": picture,
        "role": role,
        "failed_login_attempts": 0,
        "lockout_until": None,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "last_login": firestore.SERVER_TIMESTAMP,
    }

    db.collection(USERS_COLLECTION).document(uid).set(user_data)

    return user_data

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "openid",
    "email",
    "profile",
]


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


def generate_pkce_pair() -> tuple[str, str]:
    """Generate PKCE code verifier and challenge."""
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


@functions_framework.http
def gmail_auth_init(request: Request):
    """
    Initialize OAuth flow.
    Returns authorization URL with PKCE parameters.
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True) or {}
        redirect_uri = request_json.get("redirect_uri", "http://localhost:8080/auth/callback")

        # Generate PKCE pair
        code_verifier, code_challenge = generate_pkce_pair()

        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)

        client_id, _ = get_client_credentials()

        auth_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"

        return (
            json.dumps({
                "auth_url": auth_url,
                "state": state,
                "code_verifier": code_verifier,
            }),
            200,
            headers,
        )

    except Exception as e:
        return (
            json.dumps({"error": str(e)}),
            500,
            headers,
        )


@functions_framework.http
def gmail_auth_callback(request: Request):
    """
    Exchange authorization code for tokens.
    Stores tokens in Firestore and returns session info.
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return (json.dumps({"error": "Request body required"}), 400, headers)

        code = request_json.get("code")
        code_verifier = request_json.get("code_verifier")
        redirect_uri = request_json.get("redirect_uri")

        if not all([code, code_verifier, redirect_uri]):
            return (json.dumps({"error": "Missing required parameters"}), 400, headers)

        client_id, client_secret = get_client_credentials()

        # Exchange code for tokens
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            timeout=30,
        )

        if not token_response.ok:
            return (
                json.dumps({
                    "error": "Token exchange failed",
                    "details": token_response.json(),
                }),
                400,
                headers,
            )

        tokens = token_response.json()

        # Get user info
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=30,
        )

        if not userinfo_response.ok:
            return (json.dumps({"error": "Failed to get user info"}), 400, headers)

        user_info = userinfo_response.json()
        user_email = user_info.get("email")
        user_name = user_info.get("name")
        user_picture = user_info.get("picture")

        # Check if user exists in users collection
        existing_user_record = get_user_from_users_collection(user_email)

        # If user doesn't exist, check whitelist
        if not existing_user_record:
            if not is_email_whitelisted(user_email):
                return (
                    json.dumps({
                        "error": "This email is not authorized to register. Please contact an administrator.",
                    }),
                    403,
                    headers,
                )

        # Check if user already exists in gmail_tokens
        existing_user = get_user_by_email(user_email)
        uid = existing_user.get("uid") if existing_user else generate_uid()

        # Get role from whitelist or existing user
        if existing_user_record:
            role = existing_user_record.get("role", "user")
        else:
            role = get_whitelisted_role(user_email)

        # Create or update user in users collection
        user_record = create_or_update_google_user(
            uid=uid,
            email=user_email,
            name=user_name,
            picture=user_picture,
            role=role,
        )

        # Use uid from user_record (in case existing user had different uid)
        final_uid = user_record.get("uid", uid)

        # Store tokens in gmail_tokens collection (using final_uid to stay in sync)
        store_tokens(
            uid=final_uid,
            email=user_email,
            refresh_token=tokens.get("refresh_token"),
            access_token=tokens.get("access_token"),
            expires_in=tokens.get("expires_in", 3600),
            scopes=tokens.get("scope", "").split(),
            name=user_name,
            picture=user_picture,
        )

        return (
            json.dumps({
                "success": True,
                "user": {
                    "uid": final_uid,
                    "email": user_email,
                    "name": user_name,
                    "picture": user_picture,
                    "role": user_record.get("role", "user"),
                },
                "session_token": final_uid,
                "expires_in": tokens.get("expires_in"),
            }),
            200,
            headers,
        )

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)


@functions_framework.http
def gmail_auth_status(request: Request):
    """Check authentication status for a user."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return (json.dumps({"authenticated": False}), 200, headers)

    uid = auth_header.replace("Bearer ", "")
    tokens = get_tokens(uid)

    if not tokens:
        return (json.dumps({"authenticated": False}), 200, headers)

    # Get role from users collection
    user_record = get_user_from_users_collection(tokens.get("email"))
    role = user_record.get("role", "user") if user_record else "user"

    return (
        json.dumps({
            "authenticated": True,
            "user": {
                "uid": tokens.get("uid"),
                "email": tokens.get("email"),
                "name": tokens.get("name"),
                "picture": tokens.get("picture"),
                "role": role,
            },
        }),
        200,
        headers,
    )


@functions_framework.http
def gmail_auth_revoke(request: Request):
    """Revoke tokens and logout."""
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    headers = {**cors_headers(request), "Content-Type": "application/json"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return (json.dumps({"error": "Unauthorized"}), 401, headers)

    uid = auth_header.replace("Bearer ", "")

    try:
        tokens = get_tokens(uid)
        if tokens and tokens.get("access_token"):
            # Revoke token with Google
            requests.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": tokens["access_token"]},
                timeout=30,
            )

        # Delete from Firestore
        delete_tokens(uid)

        return (json.dumps({"success": True}), 200, headers)

    except Exception as e:
        return (json.dumps({"error": str(e)}), 500, headers)
