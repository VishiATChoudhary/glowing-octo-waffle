"""
User management utilities for email authentication.
Handles user CRUD operations in Firestore.
"""

import os
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from google.cloud import firestore

PROJECT_ID = os.environ.get("PROJECT_ID", "waffle-mm")
USERS_COLLECTION = "users"
WHITELIST_COLLECTION = "whitelist"


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def generate_uid() -> str:
    """Generate a new unique user ID."""
    return str(uuid.uuid4())


# ============================================================================
# Whitelist Functions
# ============================================================================

def get_whitelist_entry(email: str) -> Optional[Dict[str, Any]]:
    """
    Check if email is in the whitelist.
    Returns the whitelist entry if found, None otherwise.

    Whitelist document structure:
    whitelist/{document_id}
      - email: string (the whitelisted email)
      - role: "admin" | "user" (default role for this user)
      - added_by: string (who added this entry)
      - created_at: timestamp
    """
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
    """Get the role assigned to a whitelisted email. Defaults to 'user'."""
    entry = get_whitelist_entry(email)
    if entry:
        return entry.get("role", "user")
    return "user"


def add_to_whitelist(
    email: str,
    role: str = "user",
    added_by: str = "system",
) -> Dict[str, Any]:
    """Add an email to the whitelist."""
    db = get_firestore_client()
    email_lower = email.lower()

    # Check if already exists
    existing = get_whitelist_entry(email_lower)
    if existing:
        return existing

    whitelist_data = {
        "email": email_lower,
        "role": role,
        "added_by": added_by,
        "created_at": firestore.SERVER_TIMESTAMP,
    }

    doc_ref = db.collection(WHITELIST_COLLECTION).document()
    doc_ref.set(whitelist_data)

    # Return JSON-serializable data (exclude SERVER_TIMESTAMP sentinel)
    return {
        "id": doc_ref.id,
        "email": email_lower,
        "role": role,
        "added_by": added_by,
    }


def remove_from_whitelist(email: str) -> bool:
    """Remove an email from the whitelist and delete their user account if exists."""
    db = get_firestore_client()
    email_lower = email.lower()

    whitelist_removed = False
    user_deleted = False

    # Remove from whitelist
    docs = db.collection(WHITELIST_COLLECTION).where("email", "==", email_lower).limit(1).stream()
    for doc in docs:
        doc.reference.delete()
        whitelist_removed = True

    # Also delete the user account if it exists
    user_docs = db.collection(USERS_COLLECTION).where("email", "==", email_lower).limit(1).stream()
    for doc in user_docs:
        doc.reference.delete()
        user_deleted = True

    return whitelist_removed or user_deleted


def list_whitelist() -> list[Dict[str, Any]]:
    """List all whitelisted emails."""
    db = get_firestore_client()
    docs = db.collection(WHITELIST_COLLECTION).stream()

    result = []
    for doc in docs:
        data = doc.to_dict()
        # Convert Firestore timestamp to ISO string if present
        if "created_at" in data and data["created_at"] is not None:
            if hasattr(data["created_at"], "isoformat"):
                data["created_at"] = data["created_at"].isoformat()
            elif hasattr(data["created_at"], "timestamp"):
                data["created_at"] = datetime.fromtimestamp(data["created_at"].timestamp()).isoformat()
        result.append(data)
    return result


# ============================================================================
# User Functions
# ============================================================================


def create_user(
    email: str,
    password_hash: str,
    name: str,
    role: str = "user",
) -> Dict[str, Any]:
    """Create a new user with email/password auth."""
    db = get_firestore_client()
    uid = generate_uid()

    user_data = {
        "uid": uid,
        "email": email,
        "auth_provider": "email",
        "password_hash": password_hash,
        "email_verified": True,  # Auto-verified on registration
        "verification_token": None,
        "verification_token_expires": None,
        "reset_token": None,
        "reset_token_expires": None,
        "name": name,
        "picture": None,
        "role": role,
        "failed_login_attempts": 0,
        "lockout_until": None,
        "pipeline_quota": 10,          # Max pipeline runs allowed (lifetime)
        "pipeline_runs_used": 0,       # Current usage count
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "last_login": firestore.SERVER_TIMESTAMP,
    }

    db.collection(USERS_COLLECTION).document(uid).set(user_data)

    return user_data


def get_user_by_uid(uid: str) -> Optional[Dict[str, Any]]:
    """Get user by UID."""
    db = get_firestore_client()
    doc = db.collection(USERS_COLLECTION).document(uid).get()

    if not doc.exists:
        return None

    return doc.to_dict()


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Find user by email address."""
    db = get_firestore_client()
    docs = db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).stream()

    for doc in docs:
        return doc.to_dict()

    return None


def get_user_by_verification_token(token: str) -> Optional[Dict[str, Any]]:
    """Find user by verification token."""
    db = get_firestore_client()
    docs = db.collection(USERS_COLLECTION).where("verification_token", "==", token).limit(1).stream()

    for doc in docs:
        return doc.to_dict()

    return None


def get_user_by_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """Find user by password reset token."""
    db = get_firestore_client()
    docs = db.collection(USERS_COLLECTION).where("reset_token", "==", token).limit(1).stream()

    for doc in docs:
        return doc.to_dict()

    return None


def verify_user_email(uid: str) -> None:
    """Mark user's email as verified."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "email_verified": True,
        "verification_token": None,
        "verification_token_expires": None,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def update_verification_token(
    uid: str,
    token: str,
    expires: datetime,
) -> None:
    """Update verification token for resending."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "verification_token": token,
        "verification_token_expires": expires,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def set_reset_token(uid: str, token: str, expires: datetime) -> None:
    """Set password reset token."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "reset_token": token,
        "reset_token_expires": expires,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def update_password(uid: str, password_hash: str) -> None:
    """Update user's password hash."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "password_hash": password_hash,
        "reset_token": None,
        "reset_token_expires": None,
        "failed_login_attempts": 0,
        "lockout_until": None,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def record_login_attempt(uid: str, success: bool) -> None:
    """Record a login attempt (success or failure)."""
    db = get_firestore_client()

    if success:
        db.collection(USERS_COLLECTION).document(uid).update({
            "failed_login_attempts": 0,
            "lockout_until": None,
            "last_login": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
    else:
        # Get current attempts
        user = get_user_by_uid(uid)
        if not user:
            return

        attempts = user.get("failed_login_attempts", 0) + 1

        update_data = {
            "failed_login_attempts": attempts,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }

        # Lockout after 5 failed attempts (15 minutes)
        if attempts >= 5:
            from datetime import timedelta
            lockout_until = datetime.utcnow() + timedelta(minutes=15)
            update_data["lockout_until"] = lockout_until

        db.collection(USERS_COLLECTION).document(uid).update(update_data)


def is_user_locked_out(user: Dict[str, Any]) -> bool:
    """Check if user is currently locked out."""
    lockout_until = user.get("lockout_until")
    if not lockout_until:
        return False

    # Handle Firestore timestamp
    if hasattr(lockout_until, 'timestamp'):
        lockout_dt = datetime.fromtimestamp(lockout_until.timestamp())
    else:
        lockout_dt = lockout_until

    return lockout_dt > datetime.utcnow()


def create_or_update_google_user(
    email: str,
    name: str,
    picture: Optional[str] = None,
    role: str = "user",
) -> Dict[str, Any]:
    """Create or update a user from Google OAuth."""
    db = get_firestore_client()

    existing = get_user_by_email(email)

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
    uid = generate_uid()
    user_data = {
        "uid": uid,
        "email": email,
        "auth_provider": "google",
        "password_hash": None,
        "email_verified": True,  # Google emails are pre-verified
        "verification_token": None,
        "verification_token_expires": None,
        "reset_token": None,
        "reset_token_expires": None,
        "name": name,
        "picture": picture,
        "role": role,
        "failed_login_attempts": 0,
        "lockout_until": None,
        "pipeline_quota": 10,          # Max pipeline runs allowed (lifetime)
        "pipeline_runs_used": 0,       # Current usage count
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "last_login": firestore.SERVER_TIMESTAMP,
    }

    db.collection(USERS_COLLECTION).document(uid).set(user_data)

    return user_data


def is_admin(user: Dict[str, Any]) -> bool:
    """Check if user has admin role."""
    return user.get("role") == "admin"


def update_user_role(uid: str, role: str) -> None:
    """Update a user's role."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "role": role,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


# ============================================================================
# Pipeline Quota Functions
# ============================================================================


def check_pipeline_quota(uid: str) -> Dict[str, Any]:
    """
    Check if user can run pipeline. Returns quota info.

    Returns dict with:
    - allowed: bool - whether user can run pipeline
    - unlimited: bool - True for admins
    - used: int - runs used so far
    - quota: int - max runs allowed
    - remaining: int - runs remaining (only if not unlimited)
    - error: str - error message if not allowed
    """
    user = get_user_by_uid(uid)
    if not user:
        return {"allowed": False, "error": "User not found"}

    # Admins have unlimited runs
    if user.get("role") == "admin":
        return {"allowed": True, "unlimited": True, "used": 0, "quota": 0}

    quota = user.get("pipeline_quota", 10)
    used = user.get("pipeline_runs_used", 0)

    return {
        "allowed": used < quota,
        "unlimited": False,
        "used": used,
        "quota": quota,
        "remaining": quota - used
    }


def increment_pipeline_runs(uid: str) -> bool:
    """
    Increment pipeline run count for a user.
    Returns True if successful, False if quota exceeded.
    Admins are not counted.
    """
    user = get_user_by_uid(uid)
    if not user:
        return False

    # Admins don't count
    if user.get("role") == "admin":
        return True

    quota = user.get("pipeline_quota", 10)
    used = user.get("pipeline_runs_used", 0)

    if used >= quota:
        return False

    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "pipeline_runs_used": used + 1,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return True


def update_user_quota(uid: str, quota: int) -> None:
    """Update a user's pipeline quota (admin function)."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "pipeline_quota": quota,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def reset_user_pipeline_runs(uid: str) -> None:
    """Reset a user's pipeline run count to 0 (admin function)."""
    db = get_firestore_client()
    db.collection(USERS_COLLECTION).document(uid).update({
        "pipeline_runs_used": 0,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })


def list_users() -> list[Dict[str, Any]]:
    """List all users with their quota info (admin function)."""
    db = get_firestore_client()
    docs = db.collection(USERS_COLLECTION).stream()

    result = []
    for doc in docs:
        data = doc.to_dict()
        # Convert all Firestore timestamps to ISO strings
        timestamp_fields = [
            "created_at", "updated_at", "last_login", "lockout_until",
            "verification_token_expires", "reset_token_expires"
        ]
        for field in timestamp_fields:
            if field in data and data[field] is not None:
                try:
                    if hasattr(data[field], "isoformat"):
                        data[field] = data[field].isoformat()
                    elif hasattr(data[field], "timestamp"):
                        data[field] = datetime.fromtimestamp(data[field].timestamp()).isoformat()
                    else:
                        # Fallback: convert to string
                        data[field] = str(data[field])
                except Exception:
                    data[field] = None
        # Remove sensitive fields
        data.pop("password_hash", None)
        data.pop("reset_token", None)
        data.pop("verification_token", None)
        data.pop("reset_token_expires", None)
        data.pop("verification_token_expires", None)
        result.append(data)
    return result
