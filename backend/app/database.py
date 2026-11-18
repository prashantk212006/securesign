
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "securesign.db"

SUPER_ADMIN_EMAIL = os.getenv(
    "SUPER_ADMIN_EMAIL",
    "securesign.project@gmail.com"
).strip().lower()


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    with get_connection() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            signed_file_path TEXT,
            status TEXT DEFAULT 'Pending',
            owner_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            recipient_email TEXT,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fields_json TEXT DEFAULT '[]',
            FOREIGN KEY(document_id) REFERENCES documents(id)
        );

        CREATE TABLE IF NOT EXISTS signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            signer_name TEXT NOT NULL,
            signature_text TEXT NOT NULL,
            signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(document_id) REFERENCES documents(id)
        );
        """)

        # Upgrade existing invitations table.
        columns = db.execute(
            "PRAGMA table_info(invitations)"
        ).fetchall()
        column_names = [column["name"] for column in columns]

        if "fields_json" not in column_names:
            db.execute(
                "ALTER TABLE invitations ADD COLUMN fields_json TEXT DEFAULT '[]'"
            )

        # Upgrade existing documents table.
        columns = db.execute(
            "PRAGMA table_info(documents)"
        ).fetchall()
        column_names = [column["name"] for column in columns]

        if "signed_file_path" not in column_names:
            db.execute(
                "ALTER TABLE documents ADD COLUMN signed_file_path TEXT"
            )

        if "hidden_from_history" not in column_names:
            db.execute("""
                ALTER TABLE documents
                ADD COLUMN hidden_from_history INTEGER DEFAULT 0
            """)
               
        # Add draft and workflow fields to existing documents.
        columns = db.execute(
            "PRAGMA table_info(documents)"
        ).fetchall()
        column_names = [column["name"] for column in columns]

        draft_columns = {
            "workflow_stage": "TEXT NOT NULL DEFAULT 'uploaded'",
            "recipient_name": "TEXT",
            "recipient_email": "TEXT",
            "message": "TEXT",
            "draft_fields_json": "TEXT DEFAULT '[]'",
            "draft_saved_at": "TIMESTAMP"
        }

        for column_name, column_type in draft_columns.items():
            if column_name not in column_names:
                db.execute(
                    f"ALTER TABLE documents ADD COLUMN {column_name} {column_type}"
                )

        # Preserve the workflow status of existing documents.
        db.execute("""
            UPDATE documents
            SET workflow_stage = CASE
                WHEN status = 'Signed' THEN 'signed'
                WHEN EXISTS (
                    SELECT 1 FROM invitations i
                    WHERE i.document_id = documents.id
                ) THEN 'invitation_sent'
                ELSE 'uploaded'
            END
        """)

        # Recover existing invitation details where available.
        db.execute("""
            UPDATE documents
            SET recipient_email = (
                SELECT i.recipient_email
                FROM invitations i
                WHERE i.document_id = documents.id
                ORDER BY i.id DESC
                LIMIT 1
            ),
            draft_fields_json = COALESCE((
                SELECT i.fields_json
                FROM invitations i
                WHERE i.document_id = documents.id
                ORDER BY i.id DESC
                LIMIT 1
            ), '[]')
            WHERE EXISTS (
                SELECT 1 FROM invitations i
                WHERE i.document_id = documents.id
            )
        """)
    
        # Upgrade existing users table with roles.
        columns = db.execute(
            "PRAGMA table_info(users)"
        ).fetchall()
        column_names = [column["name"] for column in columns]

        if "role" not in column_names:
            db.execute("""
                ALTER TABLE users
                ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'
            """)

        # Add account activation status to existing users.
        if "is_active" not in column_names:
            db.execute("""
                ALTER TABLE users
                ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
            """)

        # Promote the configured main account.
        db.execute(
            "UPDATE users SET role = 'super_admin' WHERE LOWER(email) = ?",
            (SUPER_ADMIN_EMAIL,)
        )

        db.commit()
