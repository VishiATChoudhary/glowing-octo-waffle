"""
Email sender utilities using Gmail SMTP.
Sends verification and password reset emails.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587


def get_smtp_credentials() -> tuple[str, str]:
    """Get SMTP credentials from environment variables."""
    sender_email = os.environ.get("SMTP_SENDER_EMAIL")
    app_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not sender_email or not app_password:
        raise ValueError("SMTP_SENDER_EMAIL and GMAIL_APP_PASSWORD must be set")

    return sender_email, app_password


def get_frontend_url() -> str:
    """Get frontend URL from environment variables."""
    return os.environ.get("FRONTEND_URL", "http://localhost:8080")


def send_email(to_email: str, subject: str, html_content: str, text_content: str) -> None:
    """Send an email using Gmail SMTP."""
    sender_email, app_password = get_smtp_credentials()

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"Waffles <{sender_email}>"
    message["To"] = to_email

    # Attach plain text and HTML versions
    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    message.attach(part1)
    message.attach(part2)

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(sender_email, app_password)
        server.sendmail(sender_email, to_email, message.as_string())


def send_verification_email(to_email: str, name: str, token: str) -> None:
    """Send email verification email."""
    frontend_url = get_frontend_url()
    verify_url = f"{frontend_url}/verify-email?token={token}"

    subject = "Verify your email - Waffles"

    text_content = f"""Hi {name},

Welcome to Waffles! Please verify your email address by clicking the link below:

{verify_url}

This link will expire in 24 hours.

If you didn't create an account with Waffles, you can safely ignore this email.

- The Waffles Team
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .logo {{ font-size: 32px; font-weight: bold; color: #333; }}
        .content {{ background: #f9f9f9; border-radius: 8px; padding: 30px; }}
        .button {{ display: inline-block; background: #333; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 20px 0; }}
        .button:hover {{ background: #555; }}
        .footer {{ text-align: center; margin-top: 30px; font-size: 14px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Waffles</div>
        </div>
        <div class="content">
            <h2>Verify your email</h2>
            <p>Hi {name},</p>
            <p>Welcome to Waffles! Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
                <a href="{verify_url}" class="button">Verify Email</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">{verify_url}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account with Waffles, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; Waffles - Academic Discovery</p>
        </div>
    </div>
</body>
</html>
"""

    send_email(to_email, subject, html_content, text_content)


def send_password_reset_email(to_email: str, name: str, token: str) -> None:
    """Send password reset email."""
    frontend_url = get_frontend_url()
    reset_url = f"{frontend_url}/reset-password?token={token}"

    subject = "Reset your password - Waffles"

    text_content = f"""Hi {name},

You requested to reset your password for your Waffles account. Click the link below to set a new password:

{reset_url}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

- The Waffles Team
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .logo {{ font-size: 32px; font-weight: bold; color: #333; }}
        .content {{ background: #f9f9f9; border-radius: 8px; padding: 30px; }}
        .button {{ display: inline-block; background: #333; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 20px 0; }}
        .button:hover {{ background: #555; }}
        .footer {{ text-align: center; margin-top: 30px; font-size: 14px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Waffles</div>
        </div>
        <div class="content">
            <h2>Reset your password</h2>
            <p>Hi {name},</p>
            <p>You requested to reset your password for your Waffles account. Click the button below to set a new password:</p>
            <p style="text-align: center;">
                <a href="{reset_url}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">{reset_url}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
            <p>&copy; Waffles - Academic Discovery</p>
        </div>
    </div>
</body>
</html>
"""

    send_email(to_email, subject, html_content, text_content)
