"""Email-based recovery. SMTP delivery is disabled until configured."""
from email.message import EmailMessage
import hashlib
import logging
import os
import secrets
import smtplib
import ssl
from time import time
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

from Database.api.auth import password_hasher
from Database.api.resource_routes import database_cursor

router = APIRouter(prefix="/auth/password-reset", tags=["Authentication"])
logger = logging.getLogger(__name__)
LIFETIME_SECONDS = 15 * 60
RESEND_SECONDS = 120


class ResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=255)


class ResetCompletion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: SecretStr = Field(min_length=43, max_length=43)
    password: SecretStr = Field(min_length=8, max_length=128)


def reset_page():
    url = os.getenv("PASSWORD_RESET_URL", "")
    try:
        parts = urlsplit(url)
        if (parts.scheme == "https" and parts.hostname and not parts.username
                and not parts.password and not parts.fragment and not parts.query
                and os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM")):
            return url
    except ValueError:
        pass
    raise HTTPException(503, "Password recovery is not configured")


def send_reset_email(email, link):
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = email
    message["Subject"] = "Reset your RevMetrix password"
    message.set_content(f"Open this link within 15 minutes to reset your password:\n\n{link}\n\nIf you did not request this, ignore this email.")
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "465")),
                          context=ssl.create_default_context(), timeout=10) as smtp:
        if os.getenv("SMTP_USER"):
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def issue_reset(email, page):
    try:
        with database_cursor(write=True) as cursor:
            cursor.execute("SELECT user_id, email FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            if user is None:
                return
            user_id, address = user
            cursor.execute("SELECT issued_at FROM password_resets WHERE user_id = ?", (user_id,))
            previous = cursor.fetchone()
            now = int(time())
            if previous is not None and previous[0] > now - RESEND_SECONDS:
                return
            token = secrets.token_urlsafe(32)
            cursor.execute("DELETE FROM password_resets WHERE user_id = ?", (user_id,))
            cursor.execute("INSERT INTO password_resets (user_id, token_hash, issued_at, expires_at) VALUES (?, ?, ?, ?)",
                           (user_id, digest(token), now, now + LIFETIME_SECONDS))
        send_reset_email(address, f"{page}#token={token}")
    except Exception:
        # Do not log recipient, reset link, credentials, or driver error details.
        logger.warning("Password reset request could not be processed")


@router.post("/request", status_code=202)
def request_reset(data: ResetRequest, background_tasks: BackgroundTasks, response: Response):
    page = reset_page()
    response.headers["Cache-Control"] = "no-store"
    background_tasks.add_task(issue_reset, str(data.email), page)
    return {"message": "If an account matches that email, a reset link will be sent."}


@router.post("/complete", status_code=204)
def complete_reset(data: ResetCompletion):
    with database_cursor(write=True) as cursor:
        token_hash = digest(data.token.get_secret_value())
        cursor.execute("SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?",
                       (token_hash, int(time())))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(400, "Invalid or expired reset link")
        encoded_hash = password_hasher.hash(data.password.get_secret_value()).encode()
        cursor.execute("UPDATE users SET password_hash = ? WHERE user_id = ?", (encoded_hash, row[0]))
        cursor.execute("DELETE FROM password_resets WHERE user_id = ?", (row[0],))
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
