
import uuid
from pathlib import Path

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


@router.get("/")
def get_documents(current_user: dict = Depends(get_current_user)):
    with get_connection() as db:
        update_terminated_documents(db)

        documents = db.execute(
            """SELECT * FROM documents
               WHERE owner_id = ?
               ORDER BY created_at DESC""",
            (current_user["id"],)
        ).fetchall()

    return [dict(document) for document in documents]

@router.get("/history")
def get_document_history(
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as db:
        update_terminated_documents(db)

        records = db.execute(
            """
            SELECT
                d.id,
                d.title,
                d.status,
                d.created_at,
                i.recipient_email,
                i.created_at AS sent_at,
                i.expires_at,
                s.signer_name,
                s.signed_at
            FROM documents d

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

            WHERE d.owner_id = ?
            AND COALESCE(d.hidden_from_history, 0) = 0
            ORDER BY d.created_at DESC
            """,
            (current_user["id"],)
        ).fetchall()

    return [dict(record) for record in records]


@router.patch("/{document_id}/hide-from-history")
def hide_document_from_history(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as db:
        document = db.execute(
            """SELECT id FROM documents
               WHERE id = ? AND owner_id = ?""",
            (document_id, current_user["id"])
        ).fetchone()

        if not document:
            raise HTTPException(404, "Document not found")

        db.execute(
            """UPDATE documents
               SET hidden_from_history = 1
               WHERE id = ? AND owner_id = ?""",
            (document_id, current_user["id"])
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


def get_owned_document(document_id: int, user_id: int):
    with get_connection() as db:
        document = db.execute(
            """SELECT * FROM documents
               WHERE id = ? AND owner_id = ?""",
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
    document = get_owned_document(document_id, current_user["id"])
    path = Path(document["file_path"])

    if not path.is_file():
        raise HTTPException(404, "PDF file not found")

    return FileResponse(path, media_type="application/pdf")


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    document = get_owned_document(document_id, current_user["id"])
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
    document = get_owned_document(document_id, current_user["id"])

    with get_connection() as db:
        db.execute(
            "DELETE FROM signatures WHERE document_id = ?",
            (document_id,)
        )
        db.execute(
            "DELETE FROM invitations WHERE document_id = ?",
            (document_id,)
        )
        db.execute(
            "DELETE FROM documents WHERE id = ? AND owner_id = ?",
            (document_id, current_user["id"])
        )
        db.commit()

    Path(document["file_path"]).unlink(missing_ok=True)

    return {"message": "Document deleted successfully"}
