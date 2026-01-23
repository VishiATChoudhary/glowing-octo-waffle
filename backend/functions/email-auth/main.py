"""
Email Authentication Cloud Functions.
Handles email/password authentication with verification and password reset.
"""

import json
import re

import functions_framework
from flask import Request

from user_manager import (
    create_user,
    get_user_by_email,
    get_user_by_uid,
    get_user_by_reset_token,
    set_reset_token,
    update_password,
    record_login_attempt,
    is_user_locked_out,
    is_email_whitelisted,
    get_whitelisted_role,
    add_to_whitelist,
    remove_from_whitelist,
    list_whitelist,
    is_admin,
    update_user_role,
    check_pipeline_quota,
    increment_pipeline_runs,
    update_user_quota,
    reset_user_pipeline_runs,
    list_users,
)
from password_utils import hash_password, verify_password, validate_password
from token_utils import (
    generate_reset_token,
    is_token_expired,
)
from email_sender import send_password_reset_email


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


def json_response(data: dict, status: int, request: Request):
    """Return JSON response with CORS headers."""
    headers = {**cors_headers(request), "Content-Type": "application/json"}
    return (json.dumps(data), status, headers)


def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


@functions_framework.http
def email_auth_register(request: Request):
    """
    Register a new user with email/password.
    Sends verification email.

    POST body: { email, password, name }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        email = request_json.get("email", "").strip().lower()
        password = request_json.get("password", "")
        name = request_json.get("name", "").strip()

        # Validate inputs
        if not email or not password or not name:
            return json_response({"error": "Email, password, and name are required"}, 400, request)

        if not validate_email(email):
            return json_response({"error": "Invalid email format"}, 400, request)

        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return json_response({"error": error_msg}, 400, request)

        # Check if user already exists
        existing_user = get_user_by_email(email)
        if existing_user:
            if existing_user.get("auth_provider") == "google":
                return json_response(
                    {"error": "This email is registered with Google. Please sign in with Google."},
                    400,
                    request,
                )
            return json_response({"error": "An account with this email already exists"}, 400, request)

        # Check whitelist
        if not is_email_whitelisted(email):
            return json_response(
                {"error": "This email is not authorized to register. Please contact an administrator."},
                403,
                request,
            )

        # Get role from whitelist
        role = get_whitelisted_role(email)

        # Create user (auto-verified, no email verification needed)
        password_hash = hash_password(password)

        user = create_user(
            email=email,
            password_hash=password_hash,
            name=name,
            role=role,
        )

        # Return session token so user is automatically logged in
        return json_response({
            "success": True,
            "message": "Registration successful.",
            "user": {
                "uid": user["uid"],
                "email": user["email"],
                "name": user["name"],
                "role": user.get("role", "user"),
            },
            "session_token": user["uid"],
        }, 201, request)

    except Exception as e:
        print(f"Registration error: {e}")
        return json_response({"error": "Registration failed"}, 500, request)


@functions_framework.http
def email_auth_login(request: Request):
    """
    Login with email/password.
    Returns session token on success.

    POST body: { email, password }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        email = request_json.get("email", "").strip().lower()
        password = request_json.get("password", "")

        if not email or not password:
            return json_response({"error": "Email and password are required"}, 400, request)

        # Find user
        user = get_user_by_email(email)
        if not user:
            return json_response({"error": "Invalid email or password"}, 401, request)

        # Check auth provider
        if user.get("auth_provider") == "google":
            return json_response(
                {"error": "This account uses Google sign-in. Please sign in with Google."},
                400,
                request,
            )

        # Check lockout
        if is_user_locked_out(user):
            return json_response(
                {"error": "Account temporarily locked due to too many failed attempts. Please try again later."},
                429,
                request,
            )

        # Verify password
        if not verify_password(password, user.get("password_hash", "")):
            record_login_attempt(user["uid"], success=False)
            return json_response({"error": "Invalid email or password"}, 401, request)

        # Record successful login
        record_login_attempt(user["uid"], success=True)

        return json_response({
            "success": True,
            "user": {
                "uid": user["uid"],
                "email": user["email"],
                "name": user["name"],
                "picture": user.get("picture"),
                "role": user.get("role", "user"),
            },
            "session_token": user["uid"],
        }, 200, request)

    except Exception as e:
        print(f"Login error: {e}")
        return json_response({"error": "Login failed"}, 500, request)


@functions_framework.http
def email_auth_verify(request: Request):
    """
    Verify email via token link.

    GET params: token
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    try:
        token = request.args.get("token")
        if not token:
            return json_response({"error": "Verification token required"}, 400, request)

        # Find user by token
        user = get_user_by_verification_token(token)
        if not user:
            return json_response({"error": "Invalid or expired verification link"}, 400, request)

        # Check token expiry
        if is_token_expired(user.get("verification_token_expires")):
            return json_response({"error": "Verification link has expired. Please request a new one."}, 400, request)

        # Verify email
        verify_user_email(user["uid"])

        return json_response({
            "success": True,
            "message": "Email verified successfully. You can now log in.",
            "user": {
                "uid": user["uid"],
                "email": user["email"],
                "name": user["name"],
            },
        }, 200, request)

    except Exception as e:
        print(f"Verification error: {e}")
        return json_response({"error": "Verification failed"}, 500, request)


@functions_framework.http
def email_auth_resend_verification(request: Request):
    """
    Resend verification email.

    POST body: { email }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        email = request_json.get("email", "").strip().lower()
        if not email:
            return json_response({"error": "Email is required"}, 400, request)

        # Find user
        user = get_user_by_email(email)
        if not user:
            # Don't reveal if email exists
            return json_response({
                "success": True,
                "message": "If an account with this email exists, a verification email has been sent.",
            }, 200, request)

        if user.get("auth_provider") == "google":
            return json_response({
                "success": True,
                "message": "If an account with this email exists, a verification email has been sent.",
            }, 200, request)

        if user.get("email_verified"):
            return json_response({
                "success": True,
                "message": "If an account with this email exists, a verification email has been sent.",
            }, 200, request)

        # Generate new token
        token, token_expires = generate_verification_token()
        update_verification_token(user["uid"], token, token_expires)

        # Send email
        try:
            send_verification_email(email, user["name"], token)
        except Exception as e:
            print(f"Failed to send verification email: {e}")

        return json_response({
            "success": True,
            "message": "If an account with this email exists, a verification email has been sent.",
        }, 200, request)

    except Exception as e:
        print(f"Resend verification error: {e}")
        return json_response({"error": "Failed to resend verification email"}, 500, request)


@functions_framework.http
def email_auth_forgot_password(request: Request):
    """
    Request password reset email.

    POST body: { email }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        email = request_json.get("email", "").strip().lower()
        if not email:
            return json_response({"error": "Email is required"}, 400, request)

        # Find user - but don't reveal if they exist
        user = get_user_by_email(email)

        if user and user.get("auth_provider") == "email":
            # Generate reset token
            token, token_expires = generate_reset_token()
            set_reset_token(user["uid"], token, token_expires)

            # Send email
            try:
                send_password_reset_email(email, user["name"], token)
            except Exception as e:
                print(f"Failed to send password reset email: {e}")

        # Always return success to prevent email enumeration
        return json_response({
            "success": True,
            "message": "If an account with this email exists, a password reset link has been sent.",
        }, 200, request)

    except Exception as e:
        print(f"Forgot password error: {e}")
        return json_response({"error": "Failed to process request"}, 500, request)


@functions_framework.http
def email_auth_reset_password(request: Request):
    """
    Reset password with token.

    POST body: { token, password }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        token = request_json.get("token", "")
        password = request_json.get("password", "")

        if not token or not password:
            return json_response({"error": "Token and password are required"}, 400, request)

        # Validate password
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return json_response({"error": error_msg}, 400, request)

        # Find user by reset token
        user = get_user_by_reset_token(token)
        if not user:
            return json_response({"error": "Invalid or expired reset link"}, 400, request)

        # Check token expiry
        if is_token_expired(user.get("reset_token_expires")):
            return json_response({"error": "Reset link has expired. Please request a new one."}, 400, request)

        # Update password
        password_hash = hash_password(password)
        update_password(user["uid"], password_hash)

        return json_response({
            "success": True,
            "message": "Password reset successfully. You can now log in with your new password.",
        }, 200, request)

    except Exception as e:
        print(f"Reset password error: {e}")
        return json_response({"error": "Failed to reset password"}, 500, request)


@functions_framework.http
def email_auth_status(request: Request):
    """
    Check authentication status for a user.
    Works for both email and Google auth users.

    Headers: Authorization: Bearer <session_token>
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return json_response({"authenticated": False}, 200, request)

    uid = auth_header.replace("Bearer ", "")
    user = get_user_by_uid(uid)

    if not user:
        return json_response({"authenticated": False}, 200, request)

    return json_response({
        "authenticated": True,
        "user": {
            "uid": user.get("uid"),
            "email": user.get("email"),
            "name": user.get("name"),
            "picture": user.get("picture"),
            "auth_provider": user.get("auth_provider"),
            "role": user.get("role", "user"),
        },
    }, 200, request)


@functions_framework.http
def email_auth_logout(request: Request):
    """
    Logout - clears session on client side.
    For email auth, we don't need to do anything server-side.

    POST with Authorization header
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    # For email auth, logout is handled client-side by clearing the token
    # We just return success
    return json_response({"success": True}, 200, request)


# ============================================================================
# Admin Endpoints - Whitelist Management
# ============================================================================

def require_admin(request: Request):
    """
    Check if the request is from an admin user.
    Returns (user, error_response) - if user is None, return error_response.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, json_response({"error": "Unauthorized"}, 401, request)

    uid = auth_header.replace("Bearer ", "")
    user = get_user_by_uid(uid)

    if not user:
        return None, json_response({"error": "Unauthorized"}, 401, request)

    if not is_admin(user):
        return None, json_response({"error": "Admin access required"}, 403, request)

    return user, None


@functions_framework.http
def email_auth_whitelist_list(request: Request):
    """
    List all whitelisted emails. Admin only.

    GET with Authorization header
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    user, error = require_admin(request)
    if error:
        return error

    try:
        whitelist = list_whitelist()
        return json_response({
            "success": True,
            "whitelist": whitelist,
        }, 200, request)

    except Exception as e:
        print(f"List whitelist error: {e}")
        return json_response({"error": "Failed to list whitelist"}, 500, request)


@functions_framework.http
def email_auth_whitelist_add(request: Request):
    """
    Add an email to the whitelist. Admin only.

    POST body: { email, role? }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    admin_user, error = require_admin(request)
    if error:
        return error

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        email = request_json.get("email", "").strip().lower()
        role = request_json.get("role", "user")

        if not email:
            return json_response({"error": "Email is required"}, 400, request)

        if not validate_email(email):
            return json_response({"error": "Invalid email format"}, 400, request)

        if role not in ["admin", "user"]:
            return json_response({"error": "Role must be 'admin' or 'user'"}, 400, request)

        entry = add_to_whitelist(email, role, admin_user["email"])
        existing_user = get_user_by_email(email)
        if existing_user and existing_user.get("role") != role:
            update_user_role(existing_user["uid"], role)

        return json_response({
            "success": True,
            "message": f"Added {email} to whitelist as {role}",
            "entry": entry,
        }, 201, request)

    except Exception as e:
        print(f"Add to whitelist error: {e}")
        return json_response({"error": "Failed to add to whitelist"}, 500, request)


@functions_framework.http
def email_auth_whitelist_remove(request: Request):
    """
    Remove an email from the whitelist. Admin only.

    POST body: { email }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    admin_user, error = require_admin(request)
    if error:
        return error

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        email = request_json.get("email", "").strip().lower()

        if not email:
            return json_response({"error": "Email is required"}, 400, request)

        removed = remove_from_whitelist(email)

        if removed:
            return json_response({
                "success": True,
                "message": f"Removed {email} from whitelist",
            }, 200, request)
        else:
            return json_response({
                "success": False,
                "message": f"Email {email} not found in whitelist",
            }, 404, request)

    except Exception as e:
        print(f"Remove from whitelist error: {e}")
        return json_response({"error": "Failed to remove from whitelist"}, 500, request)


# ============================================================================
# Pipeline Quota Endpoints
# ============================================================================

@functions_framework.http
def email_auth_quota(request: Request):
    """
    Check or increment pipeline quota for authenticated user.

    GET: Check current quota status
    POST: Increment run count (called after successful pipeline run)

    Headers: Authorization: Bearer <session_token>

    GET Response:
    {
        "allowed": true,
        "unlimited": false,
        "used": 3,
        "quota": 10,
        "remaining": 7
    }

    POST Response:
    {
        "success": true,
        "used": 4,
        "quota": 10,
        "remaining": 6
    }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    # Authenticate user
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return json_response({"error": "Authentication required"}, 401, request)

    uid = auth_header.replace("Bearer ", "")
    user = get_user_by_uid(uid)

    if not user:
        return json_response({"error": "User not found"}, 401, request)

    try:
        if request.method == "GET":
            # Check quota status
            quota_info = check_pipeline_quota(uid)
            return json_response(quota_info, 200, request)

        elif request.method == "POST":
            # Increment run count
            success = increment_pipeline_runs(uid)

            if success:
                # Get updated quota info
                quota_info = check_pipeline_quota(uid)
                return json_response({
                    "success": True,
                    "used": quota_info.get("used", 0),
                    "quota": quota_info.get("quota", 10),
                    "remaining": quota_info.get("remaining", 0),
                    "unlimited": quota_info.get("unlimited", False),
                }, 200, request)
            else:
                return json_response({
                    "success": False,
                    "error": "Pipeline quota exceeded",
                }, 403, request)

        else:
            return json_response({"error": "Method not allowed"}, 405, request)

    except Exception as e:
        print(f"Quota check error: {e}")
        return json_response({"error": "Failed to check quota"}, 500, request)


# ============================================================================
# Admin - User Management (including quota)
# ============================================================================

@functions_framework.http
def email_auth_users_list(request: Request):
    """
    List all registered users with their quota info. Admin only.

    GET with Authorization header

    Response:
    {
        "success": true,
        "users": [
            {
                "uid": "...",
                "email": "...",
                "name": "...",
                "role": "user",
                "pipeline_quota": 10,
                "pipeline_runs_used": 3,
                ...
            }
        ]
    }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    admin_user, error = require_admin(request)
    if error:
        return error

    try:
        users = list_users()
        return json_response({
            "success": True,
            "users": users,
        }, 200, request)

    except Exception as e:
        print(f"List users error: {e}")
        return json_response({"error": "Failed to list users"}, 500, request)


@functions_framework.http
def email_auth_user_update_quota(request: Request):
    """
    Update a user's pipeline quota. Admin only.

    POST body: { uid, quota }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    admin_user, error = require_admin(request)
    if error:
        return error

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        uid = request_json.get("uid", "")
        quota = request_json.get("quota")

        if not uid:
            return json_response({"error": "User UID is required"}, 400, request)

        if quota is None or not isinstance(quota, int) or quota < 0:
            return json_response({"error": "Valid quota (non-negative integer) is required"}, 400, request)

        # Verify user exists
        user = get_user_by_uid(uid)
        if not user:
            return json_response({"error": "User not found"}, 404, request)

        update_user_quota(uid, quota)

        return json_response({
            "success": True,
            "message": f"Updated quota for {user.get('email')} to {quota}",
            "uid": uid,
            "quota": quota,
        }, 200, request)

    except Exception as e:
        print(f"Update quota error: {e}")
        return json_response({"error": "Failed to update quota"}, 500, request)


@functions_framework.http
def email_auth_user_reset_runs(request: Request):
    """
    Reset a user's pipeline run count to 0. Admin only.

    POST body: { uid }
    """
    cors_response = handle_cors(request)
    if cors_response:
        return cors_response

    admin_user, error = require_admin(request)
    if error:
        return error

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return json_response({"error": "Request body required"}, 400, request)

        uid = request_json.get("uid", "")

        if not uid:
            return json_response({"error": "User UID is required"}, 400, request)

        # Verify user exists
        user = get_user_by_uid(uid)
        if not user:
            return json_response({"error": "User not found"}, 404, request)

        reset_user_pipeline_runs(uid)

        return json_response({
            "success": True,
            "message": f"Reset pipeline runs for {user.get('email')}",
            "uid": uid,
        }, 200, request)

    except Exception as e:
        print(f"Reset runs error: {e}")
        return json_response({"error": "Failed to reset runs"}, 500, request)
