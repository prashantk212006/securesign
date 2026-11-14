
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "securesign.db"


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

               # Safely upgrade databases created before fields_json existed.
        columns = db.execute(
            "PRAGMA table_info(invitations)"
        ).fetchall()

        column_names = [column["name"] for column in columns]

        if "fields_json" not in column_names:
            db.execute(
                "ALTER TABLE invitations ADD COLUMN fields_json TEXT DEFAULT '[]'"
            )

        # Safely upgrade existing documents table.
        columns = db.execute(
            "PRAGMA table_info(documents)"
        ).fetchall()

        column_names = [column["name"] for column in columns]

        if "signed_file_path" not in column_names:
            db.execute(
                "ALTER TABLE documents ADD COLUMN signed_file_path TEXT"
            )

                # Safely add History visibility setting.
        columns = db.execute(
            "PRAGMA table_info(documents)"
        ).fetchall()

        column_names = [column["name"] for column in columns]

        if "hidden_from_history" not in column_names:
            db.execute(
                """ALTER TABLE documents
                   ADD COLUMN hidden_from_history INTEGER DEFAULT 0"""
            )

        db.commit()
        
