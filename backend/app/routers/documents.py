
import uuid
from pathlib import Path

import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from app.database import get_connection
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def update_terminated_documents(db):
    db.execute("""
        UPDATE documents
        SET status = 'Terminated'
        WHERE status = 'Pending'
          AND EXISTS (
              SELECT 1
              FROM invitations i
              WHERE i.document_id = documents.id
                AND i.id = (
                    SELECT MAX(i2.id)
                    FROM invitations i2
                    WHERE i2.document_id = documents.id
                )
                AND i.used_at IS NULL
                AND julianday(i.expires_at) <= julianday('now')
          )
    """)
    db.commit()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Maximum file size is 10 MB")

    if not content.startswith(b"%PDF-"):
        raise HTTPException(400, "Invalid PDF file")

    filename = f"{uuid.uuid4().hex}.pdf"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    try:
        with get_connection() as db:
            cursor = db.execute(
                """INSERT INTO documents
                   (title, filename, file_path, owner_id)
                   VALUES (?, ?, ?, ?)""",
                (title, filename, str(file_path), current_user["id"])
            )
            db.commit()
            document_id = cursor.lastrowid
    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    return {
        "message": "Document uploaded successfully",
        "id": document_id,
        "title": title,
        "status": "Pending"
    }



@router.post("/drafts")
async def save_new_draft(
    title: str = Form(...),
    file: UploadFile | None = File(None),
    recipient_name: str = Form(""),
    recipient_email: str = Form(""),
    message: str = Form(""),
    fields_json: str = Form("[]"),
    workflow_stage: str = Form("uploaded"),
    current_user: dict = Depends(get_current_user)
):
    if not title.strip():
        raise HTTPException(400, "Document title is required")

    if not file or not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "A PDF file is required for a new draft")

    try:
        fields = json.loads(fields_json)
        if not isinstance(fields, list):
            raise ValueError()
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(400, "Invalid signature fields")

    allowed_stages = {"uploaded", "details_completed", "fields_placed"}
    if workflow_stage not in allowed_stages:
        raise HTTPException(400, "Invalid draft workflow stage")

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Maximum file size is 10 MB")

    if not content.startswith(b"%PDF-"):
        raise HTTPException(400, "Invalid PDF file")

    filename = f"{uuid.uuid4().hex}.pdf"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    try:
        with get_connection() as db:
            cursor = db.execute(
                """
                INSERT INTO documents (
                    title, filename, file_path, owner_id,
                    status, workflow_stage, recipient_name,
                    recipient_email, message, draft_fields_json,
                    draft_saved_at
                )
                VALUES (?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    title.strip(),
                    filename,
                    str(file_path),
                    current_user["id"],
                    workflow_stage,
                    recipient_name.strip(),
                    recipient_email.strip(),
                    message,
                    json.dumps(fields)
                )
            )
            db.commit()
            document_id = cursor.lastrowid
    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    return {
        "message": "Draft saved successfully",
        "id": document_id,
        "status": "Draft",
        "workflow_stage": workflow_stage
    }


@router.put("/drafts/{document_id}")
async def update_existing_draft(
    document_id: int,
    title: str = Form(...),
    file: UploadFile | None = File(None),
    recipient_name: str = Form(""),
    recipient_email: str = Form(""),
    message: str = Form(""),
    fields_json: str = Form("[]"),
    workflow_stage: str = Form("uploaded"),
    current_user: dict = Depends(get_current_user)
):
    if not title.strip():
        raise HTTPException(400, "Document title is required")

    try:
        fields = json.loads(fields_json)
        if not isinstance(fields, list):
            raise ValueError()
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(400, "Invalid signature fields")

    allowed_stages = {"uploaded", "details_completed", "fields_placed"}
    if workflow_stage not in allowed_stages:
        raise HTTPException(400, "Invalid draft workflow stage")

    new_path = None

    if file is not None:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(400, "Only PDF files are allowed")

        content = await file.read()

        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(400, "Maximum file size is 10 MB")

        if not content.startswith(b"%PDF-"):
            raise HTTPException(400, "Invalid PDF file")

        filename = f"{uuid.uuid4().hex}.pdf"
        new_path = UPLOAD_DIR / filename
        new_path.write_bytes(content)

    try:
        with get_connection() as db:
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

            if document["workflow_stage"] in ("invitation_sent", "signed") or document["status"] == "Signed":
                raise HTTPException(400, "This document is no longer an editable draft")

            if document["status"] != "Draft":
                raise HTTPException(400, "Only drafts can be edited here")

            if new_path:
                db.execute(
                    """
                    UPDATE documents
                    SET title = ?, filename = ?, file_path = ?,
                        recipient_name = ?, recipient_email = ?,
                        message = ?, draft_fields_json = ?,
                        workflow_stage = ?, draft_saved_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        title.strip(), new_path.name, str(new_path),
                        recipient_name.strip(), recipient_email.strip(),
                        message, json.dumps(fields), workflow_stage,
                        document_id
                    )
                )
            else:
                db.execute(
                    """
                    UPDATE documents
                    SET title = ?, recipient_name = ?,
                        recipient_email = ?, message = ?,
                        draft_fields_json = ?, workflow_stage = ?,
                        draft_saved_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        title.strip(), recipient_name.strip(),
                        recipient_email.strip(), message,
                        json.dumps(fields), workflow_stage, document_id
                    )
                )

            db.commit()

            old_path = Path(document["file_path"])

        if new_path and old_path != new_path:
            old_path.unlink(missing_ok=True)

    except Exception:
        if new_path:
            new_path.unlink(missing_ok=True)
        raise

    return {
        "message": "Draft updated successfully",
        "id": document_id,
        "status": "Draft",
        "workflow_stage": workflow_stage
    }




@router.get("/drafts/{document_id}")
def get_saved_draft(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as db:
        if current_user["role"] == "super_admin":
            document = db.execute(
                """
                SELECT id, title, filename, file_path, status,
                       workflow_stage, recipient_name, recipient_email,
                       message, draft_fields_json, draft_saved_at,
                       created_at
                FROM documents
                WHERE id = ? AND status = 'Draft'
                """,
                (document_id,)
            ).fetchone()
        else:
            document = db.execute(
                """
                SELECT id, title, filename, file_path, status,
                       workflow_stage, recipient_name, recipient_email,
                       message, draft_fields_json, draft_saved_at,
                       created_at
                FROM documents
                WHERE id = ? AND owner_id = ? AND status = 'Draft'
                """,
                (document_id, current_user["id"])
            ).fetchone()

    if not document:
        raise HTTPException(404, "Draft not found")

    result = dict(document)

    try:
        result["fields"] = json.loads(
            result.pop("draft_fields_json") or "[]"
        )
    except (json.JSONDecodeError, TypeError):
        result["fields"] = []

    # Do not expose the server's internal file-system path.
    result.pop("file_path", None)

    return result


@router.get("/pending-requests")
def get_pending_requests(
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as db:
        update_terminated_documents(db)

        owner_filter = ""
        params = ()

        if current_user["role"] != "super_admin":
            owner_filter = "AND d.owner_id = ?"
            params = (current_user["id"],)

        records = db.execute(
            f"""
            SELECT
                d.id,
                d.title,
                d.status,
                d.workflow_stage,
                d.recipient_name,
                d.recipient_email,
                d.message,
                d.draft_fields_json,
                d.draft_saved_at,
                d.created_at,
                d.owner_id,
                u.name AS owner_name,
                i.created_at AS sent_at,
                i.expires_at,
                i.used_at
            FROM documents d

            LEFT JOIN users u
                ON u.id = d.owner_id

            LEFT JOIN invitations i
                ON i.id = (
                    SELECT MAX(i2.id)
                    FROM invitations i2
                    WHERE i2.document_id = d.id
                )

            WHERE d.status IN ('Draft', 'Pending')
              AND COALESCE(d.status, '') NOT IN ('Signed', 'Rejected', 'Terminated')
              {owner_filter}
            ORDER BY COALESCE(d.draft_saved_at, d.created_at) DESC
            """,
            params
        ).fetchall()

    return [dict(record) for record in records]



@router.get("/")
def get_documents(current_user: dict = Depends(get_current_user)):
    with get_connection() as db:
        update_terminated_documents(db)

        if current_user["role"] == "super_admin":
            documents = db.execute(
                """
                SELECT
                    d.*,
                    u.name AS owner_name,
                    u.email AS owner_email
                FROM documents d
                LEFT JOIN users u ON u.id = d.owner_id
                ORDER BY d.created_at DESC
                """
            ).fetchall()
        else:
            documents = db.execute(
                """
                SELECT *
                FROM documents
                WHERE owner_id = ?
                ORDER BY created_at DESC
                """,
                (current_user["id"],)
            ).fetchall()

    return [dict(document) for document in documents]


@router.get("/history")
def get_document_history(
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as db:
        update_terminated_documents(db)

        owner_filter = ""
        params = ()

        if current_user["role"] != "super_admin":
            owner_filter = "AND d.owner_id = ?"
            params = (current_user["id"],)

        records = db.execute(
            f"""
            SELECT
                d.id,
                d.title,
                d.status,
                d.created_at,
                d.owner_id,
                u.name AS owner_name,
                u.email AS owner_email,
                i.recipient_email,
                i.created_at AS sent_at,
                i.expires_at,
                s.signer_name,
                s.signed_at
            FROM documents d

            LEFT JOIN users u
                ON u.id = d.owner_id

            LEFT JOIN invitations i
                ON i.id = (
                    SELECT MAX(i2.id)
                    FROM invitations i2
                    WHERE i2.document_id = d.id
                )

            LEFT JOIN signatures s
                ON s.id = (
                    SELECT MAX(s2.id)
                    FROM signatures s2
                    WHERE s2.document_id = d.id
                )

            WHERE COALESCE(d.hidden_from_history, 0) = 0
            {owner_filter}
            ORDER BY d.created_at DESC
            """,
            params
        ).fetchall()

    return [dict(record) for record in records]


@router.patch("/{document_id}/hide-from-history")
def hide_document_from_history(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as db:
        if current_user["role"] == "super_admin":
            document = db.execute(
                "SELECT id FROM documents WHERE id = ?",
                (document_id,)
            ).fetchone()
        else:
            document = db.execute(
                """
                SELECT id FROM documents
                WHERE id = ? AND owner_id = ?
                """,
                (document_id, current_user["id"])
            ).fetchone()

        if not document:
            raise HTTPException(404, "Document not found")

        db.execute(
            "UPDATE documents SET hidden_from_history = 1 WHERE id = ?",
            (document_id,)
        )

        # Migrate existing unused invitations from 7-day expiry
        # to 24 hours after their original creation time.
        db.execute("""
            UPDATE invitations
            SET expires_at = strftime(
                '%Y-%m-%dT%H:%M:%S+00:00',
                created_at,
                '+24 hours'
            )
            WHERE used_at IS NULL
              AND created_at IS NOT NULL
              AND julianday(expires_at) >
                  julianday(created_at, '+24 hours')
        """)

        db.commit()

    return {
        "message": "Document removed from History successfully"
    }


def get_owned_document(
    document_id: int,
    user_id: int,
    user_role: str = "admin"
):
    with get_connection() as db:
        if user_role == "super_admin":
            document = db.execute(
                """
                SELECT *
                FROM documents
                WHERE id = ?
                """,
                (document_id,)
            ).fetchone()
        else:
            document = db.execute(
                """
                SELECT *
                FROM documents
                WHERE id = ? AND owner_id = ?
                """,
                (document_id, user_id)
            ).fetchone()

    if not document:
        raise HTTPException(404, "Document not found")

    return dict(document)


@router.get("/{document_id}/view")
def view_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    document = get_owned_document(
        document_id,
        current_user["id"],
        current_user["role"]
    )

    path = Path(document["file_path"])

    if not path.is_file():
        raise HTTPException(404, "PDF file not found")

    return FileResponse(path, media_type="application/pdf")


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    document = get_owned_document(
        document_id,
        current_user["id"],
        current_user["role"]
    )

    path = Path(document["file_path"])

    if not path.is_file():
        raise HTTPException(404, "PDF file not found")

    return FileResponse(
        path,
        media_type="application/pdf",
        filename=document["title"] + ".pdf"
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    document = get_owned_document(
        document_id,
        current_user["id"],
        current_user["role"]
    )

    with get_connection() as db:
        db.execute(
            "DELETE FROM signatures WHERE document_id = ?",
            (document_id,)
        )
        db.execute(
            "DELETE FROM invitations WHERE document_id = ?",
            (document_id,)
        )

        if current_user["role"] == "super_admin":
            db.execute(
                "DELETE FROM documents WHERE id = ?",
                (document_id,)
            )
        else:
            db.execute(
                """
                DELETE FROM documents
                WHERE id = ? AND owner_id = ?
                """,
                (document_id, current_user["id"])
            )

        db.commit()

    Path(document["file_path"]).unlink(missing_ok=True)

    return {"message": "Document deleted successfully"}
