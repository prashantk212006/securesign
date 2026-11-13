
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr

from app.database import get_connection
from app.core.dependencies import get_current_user


router = APIRouter(prefix="/api/signatures", tags=["Signatures"])


# -----------------------------
# REQUEST MODELS
# -----------------------------

class InvitationRequest(BaseModel):
    recipient_email: EmailStr | None = None


class SignRequest(BaseModel):
    signer_name: str
    signature_text: str


# -----------------------------
# CREATE SIGNING INVITATION
# -----------------------------

@router.post("/invite/{document_id}")
def create_invitation(
    document_id: int,
    data: InvitationRequest,
    current_user: dict = Depends(get_current_user)
):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    with get_connection() as db:
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
               (document_id, token, recipient_email, expires_at)
               VALUES (?, ?, ?, ?)""",
            (
                document_id,
                token,
                data.recipient_email,
                expires_at.isoformat()
            )
        )

        db.commit()

    return {
        "message": "Signing invitation created",
        "signing_token": token,
        "signing_url": f"/sign/{token}",
        "expires_in_days": 7
    }


# -----------------------------
# VALIDATE SIGNING INVITATION
# -----------------------------

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

        expires_at = datetime.fromisoformat(
            invitation["expires_at"]
        )

        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(400, "Signing link expired")

        document = db.execute(
            "SELECT id, title, status FROM documents WHERE id = ?",
            (invitation["document_id"],)
        ).fetchone()

        if not document or document["status"] == "Signed":
            raise HTTPException(400, "Document cannot be signed")

        return dict(document)


# -----------------------------
# VIEW PDF THROUGH SIGNING LINK
# -----------------------------

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

        expires_at = datetime.fromisoformat(
            invitation["expires_at"]
        )

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


# -----------------------------
# SUBMIT DIGITAL SIGNATURE
# -----------------------------

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

        expires_at = datetime.fromisoformat(
            invitation["expires_at"]
        )

        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(400, "Signing link expired")

        document = db.execute(
            "SELECT * FROM documents WHERE id = ?",
            (invitation["document_id"],)
        ).fetchone()

        if not document or document["status"] == "Signed":
            raise HTTPException(400, "Document cannot be signed")

        db.execute(
            """INSERT INTO signatures
               (document_id, signer_name, signature_text)
               VALUES (?, ?, ?)""",
            (
                document["id"],
                data.signer_name.strip(),
                data.signature_text
            )
        )

        db.execute(
            "UPDATE invitations SET used_at = ? WHERE id = ?",
            (
                datetime.now(timezone.utc).isoformat(),
                invitation["id"]
            )
        )

        db.execute(
            "UPDATE documents SET status = 'Signed' WHERE id = ?",
            (document["id"],)
        )

        db.commit()

    return {
        "message": "Document signed successfully",
        "document_id": document["id"],
        "status": "Signed"
    }


# -----------------------------
# GET SIGNATURES FOR A DOCUMENT
# -----------------------------

@router.get("/document/{document_id}")
def get_document_signatures(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):

    with get_connection() as db:
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
