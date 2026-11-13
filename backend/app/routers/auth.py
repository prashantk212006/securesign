
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.database import get_connection
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register(data: RegisterRequest):

    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    with get_connection() as db:
        existing = db.execute(
            "SELECT id FROM users WHERE email = ?",
            (data.email,)
        ).fetchone()

        if existing:
            raise HTTPException(400, "Email already registered")

        cursor = db.execute(
            """INSERT INTO users (name, email, hashed_password)
               VALUES (?, ?, ?)""",
            (data.name, data.email, hash_password(data.password))
        )

        db.commit()

        return {
            "message": "Account created successfully",
            "user": {
                "id": cursor.lastrowid,
                "name": data.name,
                "email": data.email
            }
        }


@router.post("/login")
def login(data: LoginRequest):

    with get_connection() as db:
        user = db.execute(
            "SELECT * FROM users WHERE email = ?",
            (data.email,)
        ).fetchone()

    if not user or not verify_password(
        data.password, user["hashed_password"]
    ):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token({"sub": str(user["id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }
