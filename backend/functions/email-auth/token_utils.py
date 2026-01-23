"""
Token utilities for email authentication.
Handles secure token generation for verification and password reset.
"""

import secrets
from datetime import datetime, timedelta


def generate_verification_token() -> tuple[str, datetime]:
    """
    Generate a secure verification token.
    Returns (token, expiry_datetime).
    Token expires in 24 hours.
    """
    token = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(hours=24)
    return token, expiry


def generate_reset_token() -> tuple[str, datetime]:
    """
    Generate a secure password reset token.
    Returns (token, expiry_datetime).
    Token expires in 1 hour.
    """
    token = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(hours=1)
    return token, expiry


def is_token_expired(expiry: datetime) -> bool:
    """
    Check if a token has expired.
    Handles both datetime objects and Firestore timestamps.
    """
    if expiry is None:
        return True

    # Handle Firestore timestamp
    if hasattr(expiry, 'timestamp'):
        expiry_dt = datetime.fromtimestamp(expiry.timestamp())
    else:
        expiry_dt = expiry

    return expiry_dt < datetime.utcnow()
