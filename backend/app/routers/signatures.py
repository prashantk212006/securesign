
import os
import secrets
import html
import base64
import re
import json
import smtplib

from datetime import datetime, timedelta, timezone
from pathlib import Path
from email.message import EmailMessage

import pymupdf
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field

from app.database import get_connection
from app.core.dependencies import get_current_user


# --------------------------------------------------
# LOAD ENVIRONMENT VARIABLES
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(dotenv_path=ENV_FILE, override=False)

router = APIRouter(prefix="/api/signatures", tags=["Signatures"])


# --------------------------------------------------
# GENERATE THE FINAL SIGNED PDF
# --------------------------------------------------

def generate_signed_pdf(document, invitation, signature_data_url, signed_at):
    original_path = Path(document["file_path"])

    if not original_path.is_file():
        raise HTTPException(404, "Original PDF file not found")

    match = re.fullmatch(
        r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)",
        signature_data_url
    )

    if not match:
        raise HTTPException(400, "Invalid signature image format")

    try:
        signature_bytes = base64.b64decode(
            match.group(2),
            validate=True
        )
    except Exception:
        raise HTTPException(400, "Could not decode signature image")

    try:
        fields = json.loads(invitation["fields_json"] or "[]")
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(400, "Invalid PDF field configuration")

    if not isinstance(fields, list) or not fields:
        raise HTTPException(400, "No signing fields were assigned")

    signed_date = datetime.fromisoformat(
        signed_at
    ).strftime("%d-%m-%Y")

    output_dir = BACKEND_DIR / "signed_documents"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"document_{document['id']}_signed.pdf"
    temp_path = output_dir / f"document_{document['id']}_signed.tmp.pdf"

    pdf = None

    try:
        pdf = pymupdf.open(original_path)

        signature_placed = False

        for field in fields:
            field_type = str(field.get("type", "")).lower()
            page_number = int(field.get("page", 1))

            if page_number < 1 or page_number > len(pdf):
                raise ValueError("A field refers to an invalid PDF page")

            page = pdf[page_number - 1]

            x = float(field["x"])
            y = float(field["y"])
            width = float(field["width"])
            height = float(field["height"])

            if (
                x < 0 or y < 0 or width <= 0 or height <= 0
                or x + width > 1 or y + height > 1
            ):
                raise ValueError("A PDF field has invalid coordinates")

            page_rect = page.rect

            rect = pymupdf.Rect(
                x * page_rect.width,
                y * page_rect.height,
                (x + width) * page_rect.width,
                (y + height) * page_rect.height
            )

            if field_type == "signature":
                page.insert_image(
                    rect,
                    stream=signature_bytes,
                    keep_proportion=True
                )
                signature_placed = True

            elif field_type == "date":
                result = page.insert_textbox(
                    rect,
                    signed_date,
                    fontsize=10,
                    fontname="helv",
                    align=0
                )

                if result < 0:
                    raise ValueError("Date does not fit in its assigned field")

        if not signature_placed:
            raise ValueError("No signature field was found")

        pdf.save(temp_path, garbage=4, deflate=True)
        pdf.close()
        pdf = None

        os.replace(temp_path, output_path)

        return str(output_path)

    except HTTPException:
        raise

    except Exception as error:
        if pdf is not None:
            pdf.close()

        if temp_path.exists():
            temp_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=f"Could not generate signed PDF: {error}"
        )


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class InvitationRequest(BaseModel):
    recipient_email: EmailStr | None = None
    fields: list[dict] = Field(default_factory=list)


class SignRequest(BaseModel):
    signer_name: str
    signature_text: str


# --------------------------------------------------
# GMAIL SMTP EMAIL SENDER
# --------------------------------------------------

def send_via_gmail(message):

    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_APP_PASSWORD")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not smtp_email or not smtp_password:
        raise RuntimeError("Gmail SMTP credentials are missing.")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_email, smtp_password.replace(" ", ""))
        server.send_message(message)


# --------------------------------------------------
# SEND SIGNING INVITATION EMAIL
# --------------------------------------------------

def send_signing_email(recipient_email, document_title, signing_url):

    smtp_email = os.getenv("SMTP_EMAIL")

    safe_title = html.escape(document_title)
    safe_url = html.escape(signing_url, quote=True)

    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #2563eb;">SecureSign</h2>
        <p>You have received a document that requires your digital signature.</p>
        <h3>{safe_title}</h3>
        <p>Click below to review and sign your document.</p>
        <a href="{safe_url}"
           style="display:inline-block;padding:12px 24px;
           background:#2563eb;color:white;text-decoration:none;
           border-radius:6px;">
            Review and Sign Document
        </a>
        <p>This signing link is valid for 24 hours and can only be used once.</p>
        <p>If you were not expecting this document, you can ignore this email.</p>
        <hr>
        <p style="color:#777;font-size:12px;">
            Sent securely using SecureSign.
        </p>
    </div>
    """

    message = EmailMessage()
    message["Subject"] = f"Document Requires Your Signature: {document_title}"
    message["From"] = smtp_email
    message["To"] = str(recipient_email)

    message.set_content(
        f"You have received a document requiring your signature: {document_title}\n"
        f"Open this link to sign: {signing_url}"
    )

    message.add_alternative(email_html, subtype="html")

    try:
        send_via_gmail(message)
        print("SIGNING INVITATION EMAIL SENT:", recipient_email)

    except Exception as error:
        print("GMAIL INVITATION EMAIL ERROR:", str(error))
        raise HTTPException(
            status_code=502,
            detail="Could not send signing invitation through Gmail."
        )


# --------------------------------------------------
# SEND SIGNED PDF TO RECIPIENT USING GMAIL
# --------------------------------------------------

def send_signed_document_email(recipient_email, document_title, signed_pdf_path):

    smtp_email = os.getenv("SMTP_EMAIL")
    pdf_path = Path(signed_pdf_path)

    if not pdf_path.is_file():
        print("SIGNED PDF EMAIL ERROR: PDF file not found.")
        return False

    try:
        safe_title = html.escape(document_title)

        message = EmailMessage()
        message["Subject"] = f"Your Signed Document: {document_title}"
        message["From"] = smtp_email
        message["To"] = str(recipient_email)

        message.set_content(
            f"Your document '{document_title}' has been signed successfully. "
            "Please find the signed PDF attached."
        )

        message.add_alternative(
            f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2 style="color: #2563eb;">SecureSign</h2>
                <h3>Your document has been successfully signed!</h3>
                <p>Your document <strong>{safe_title}</strong>
                has been signed successfully.</p>
                <p>Please find your completed signed PDF attached.</p>
                <p>Thank you for using SecureSign.</p>
            </div>
            """,
            subtype="html"
        )

        message.add_attachment(
            pdf_path.read_bytes(),
            maintype="application",
            subtype="pdf",
            filename=f"document_{pdf_path.stem}.pdf"
        )

        send_via_gmail(message)

        print("SIGNED PDF EMAIL SENT:", recipient_email)
        return True

    except Exception as error:
        print("SIGNED PDF EMAIL ERROR:", str(error))
        return False


# --------------------------------------------------
# CREATE SIGNING INVITATION
# --------------------------------------------------

@router.post("/invite/{document_id}")
def create_invitation(
    document_id: int,
    data: InvitationRequest,
    current_user: dict = Depends(get_current_user)
):

    if data.recipient_email and (
        not os.getenv("SMTP_EMAIL")
        or not os.getenv("SMTP_APP_PASSWORD")
    ):
        raise HTTPException(
            status_code=500,
            detail="Gmail SMTP credentials are not configured. Check backend/.env."
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    fields_json = json.dumps(data.fields)

    with get_connection() as db:

        # Super Admin can create invitations for any administrator's document.
        if current_user["role"] == "super_admin":
            document = db.execute(
                "SELECT * FROM documents WHERE id = ?",
                (document_id,)
            ).fetchone()
        else:
            document = db.execute(
                "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
                (document_id, current_user["id"])
            ).fetchone()

        if not document:
            raise HTTPException(404, "Document not found")

        if document["status"] == "Signed":
            raise HTTPException(400, "Document already signed")

        db.execute(
            """INSERT INTO invitations
               (document_id, token, recipient_email, expires_at, fields_json)
               VALUES (?, ?, ?, ?, ?)""",
            (
                document_id,
                token,
                str(data.recipient_email) if data.recipient_email else None,
                expires_at.isoformat(),
                fields_json
            )
        )

        db.commit()

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173"
    ).rstrip("/")

    signing_url = f"{frontend_url}/sign/{token}"

    if data.recipient_email:
        try:
            send_signing_email(
                data.recipient_email,
                document["title"],
                signing_url
            )

        except HTTPException:
            with get_connection() as db:
                db.execute(
                    "DELETE FROM invitations WHERE token = ?",
                    (token,)
                )
                db.commit()

            raise
        
                # Update document after successful email delivery.
        with get_connection() as db:
            db.execute(
                """
                UPDATE documents
                SET status = 'Pending',
                    workflow_stage = 'invitation_sent',
                    draft_fields_json = ?
                WHERE id = ?
                """,
                (fields_json, document_id)
            )
            db.commit()

        return {
            "message": "Signing invitation sent successfully by email.",
            "email_sent": True,
            "signing_token": token,
            "signing_url": signing_url,
            "expires_in_hours": 24
        }

    return {
        "message": "Signing invitation created.",
        "email_sent": False,
        "signing_token": token,
        "signing_url": signing_url,
        "expires_in_hours": 24
    }


# --------------------------------------------------
# VALIDATE SIGNING INVITATION
# --------------------------------------------------

@router.get("/invitation/{token}")
def validate_invitation(token: str):

    with get_connection() as db:

        invitation = db.execute(
            "SELECT * FROM invitations WHERE token = ?",
            (token,)
        ).fetchone()

        if not invitation:
            raise HTTPException(404, "Invalid signing link")

        if invitation["used_at"]:
            raise HTTPException(400, "Signing link already used")

        expires_at = datetime.fromisoformat(invitation["expires_at"])

        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(400, "Signing link expired")

        # This is a public client endpoint.
        # Access is verified through the unique invitation token.
        document = db.execute(
            "SELECT * FROM documents WHERE id = ?",
            (invitation["document_id"],)
        ).fetchone()

        if not document or document["status"] == "Signed":
            raise HTTPException(400, "Document cannot be signed")

        try:
            fields = json.loads(invitation["fields_json"] or "[]")
        except (json.JSONDecodeError, TypeError):
            fields = []

        response = dict(document)
        response["fields"] = fields

        return response


# --------------------------------------------------
# VIEW PDF THROUGH SIGNING LINK
# --------------------------------------------------

@router.get("/invitation/{token}/document")
def view_invitation_document(token: str):

    with get_connection() as db:

        invitation = db.execute(
            "SELECT * FROM invitations WHERE token = ?",
            (token,)
        ).fetchone()

        if not invitation:
            raise HTTPException(404, "Invalid signing link")

        if invitation["used_at"]:
            raise HTTPException(400, "Signing link already used")

        expires_at = datetime.fromisoformat(invitation["expires_at"])

        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(400, "Signing link expired")

        document = db.execute(
            "SELECT * FROM documents WHERE id = ?",
            (invitation["document_id"],)
        ).fetchone()

        if not document or document["status"] == "Signed":
            raise HTTPException(400, "Document cannot be viewed")

        file_path = Path(document["file_path"])

    if not file_path.is_file():
        raise HTTPException(404, "PDF file not found")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline"
        }
    )


# --------------------------------------------------
# SUBMIT DIGITAL SIGNATURE
# --------------------------------------------------

@router.post("/invitation/{token}/sign")
def sign_document(token: str, data: SignRequest):

    if not data.signer_name.strip():
        raise HTTPException(400, "Signer name is required")

    if not data.signature_text.startswith("data:image/"):
        raise HTTPException(400, "Invalid signature image")

    with get_connection() as db:

        invitation = db.execute(
            "SELECT * FROM invitations WHERE token = ?",
            (token,)
        ).fetchone()

        if not invitation:
            raise HTTPException(404, "Invalid signing link")

        if invitation["used_at"]:
            raise HTTPException(400, "Signing link already used")

        expires_at = datetime.fromisoformat(invitation["expires_at"])

        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(400, "Signing link expired")

        document = db.execute(
            "SELECT * FROM documents WHERE id = ?",
            (invitation["document_id"],)
        ).fetchone()

        if not document or document["status"] == "Signed":
            raise HTTPException(400, "Document cannot be signed")

        signed_at = datetime.now(timezone.utc).isoformat()

        signed_pdf_path = generate_signed_pdf(
            document,
            invitation,
            data.signature_text,
            signed_at
        )

        db.execute(
            """INSERT INTO signatures
               (document_id, signer_name, signature_text, signed_at)
               VALUES (?, ?, ?, ?)""",
            (
                document["id"],
                data.signer_name.strip(),
                data.signature_text,
                signed_at
            )
        )

        db.execute(
            "UPDATE invitations SET used_at = ? WHERE id = ?",
            (signed_at, invitation["id"])
        )

        db.execute(
            """UPDATE documents
               SET status = 'Signed',
                   workflow_stage = 'signed',
                   signed_file_path = ?
               WHERE id = ?""",
            (signed_pdf_path, document["id"])
        )        

        db.commit()

    email_sent = False
    recipient_email = invitation["recipient_email"]

    if recipient_email:
        email_sent = send_signed_document_email(
            recipient_email,
            document["title"],
            signed_pdf_path
        )

    return {
        "message": "Document signed and PDF generated successfully",
        "document_id": document["id"],
        "status": "Signed",
        "email_sent": email_sent
    }


# --------------------------------------------------
# GET SIGNATURES FOR A DOCUMENT
# --------------------------------------------------

@router.get("/document/{document_id}")
def get_document_signatures(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):

    with get_connection() as db:

        # Super Admin can view signatures for every document.
        if current_user["role"] == "super_admin":
            document = db.execute(
                "SELECT id FROM documents WHERE id = ?",
                (document_id,)
            ).fetchone()
        else:
            document = db.execute(
                "SELECT id FROM documents WHERE id = ? AND owner_id = ?",
                (document_id, current_user["id"])
            ).fetchone()

        if not document:
            raise HTTPException(404, "Document not found")

        signatures = db.execute(
            """SELECT id, document_id, signer_name, signed_at
               FROM signatures
               WHERE document_id = ?""",
            (document_id,)
        ).fetchall()

    return [
        dict(signature)
        for signature in signatures
    ]


# --------------------------------------------------
# DOWNLOAD SIGNED PDF (ADMIN ONLY)
# --------------------------------------------------

@router.get("/document/{document_id}/signed-download")
def download_signed_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):

    with get_connection() as db:

        # Super Admin can download any administrator's signed document.
        if current_user["role"] == "super_admin":
            document = db.execute(
                """
                SELECT id, signed_file_path, status
                FROM documents
                WHERE id = ?
                """,
                (document_id,)
            ).fetchone()
        else:
            document = db.execute(
                """
                SELECT id, signed_file_path, status
                FROM documents
                WHERE id = ? AND owner_id = ?
                """,
                (document_id, current_user["id"])
            ).fetchone()

    if not document:
        raise HTTPException(404, "Document not found")

    if document["status"] != "Signed" or not document["signed_file_path"]:
        raise HTTPException(404, "Signed PDF is not available")

    file_path = Path(document["signed_file_path"])

    if not file_path.is_file():
        raise HTTPException(404, "Signed PDF file not found")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=f"document_{document_id}_signed.pdf"
    )
