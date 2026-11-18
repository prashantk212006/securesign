
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from app.database import get_connection
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def require_super_admin(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Only the Super Admin can manage administrator accounts"
        )

    return user


@router.post("/register")
def register(data: RegisterRequest):
    raise HTTPException(
        status_code=403,
        detail="Public registration is disabled. Contact the Super Admin."
    )


@router.post("/login")
def login(data: LoginRequest):
    with get_connection() as db:
        user = db.execute(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
            (str(data.email),)
        ).fetchone()

    if not user or not verify_password(
        data.password, user["hashed_password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Contact the Super Admin."
        )

    token = create_access_token({"sub": str(user["id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user["is_active"]
        }
    }


@router.get("/admins")
def list_admins(user=Depends(require_super_admin)):
    with get_connection() as db:
        admins = db.execute(
            """
            SELECT id, name, email, role, created_at, is_active
            FROM users
            ORDER BY id ASC
            """
        ).fetchall()

    return [dict(admin) for admin in admins]


@router.post("/admins", status_code=201)
def create_admin(
    data: RegisterRequest,
    user=Depends(require_super_admin)
):
    if len(data.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters"
        )

    email = str(data.email).lower()

    with get_connection() as db:
        existing = db.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            (email,)
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="This email is already registered"
            )

        cursor = db.execute(
            """
            INSERT INTO users (name, email, hashed_password, role)
            VALUES (?, ?, ?, 'admin')
            """,
            (
                data.name.strip(),
                email,
                hash_password(data.password)
            )
        )

        db.commit()

        return {
            "message": "Admin account created successfully",
            "admin": {
                "id": cursor.lastrowid,
                "name": data.name.strip(),
                "email": email,
                "role": "admin",
                "is_active": 1
            }
        }


@router.patch("/admins/{admin_id}/deactivate")
def deactivate_admin(
    admin_id: int,
    user=Depends(require_super_admin)
):
    if admin_id == user["id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )

    with get_connection() as db:
        target = db.execute(
            "SELECT id, role, is_active FROM users WHERE id = ?",
            (admin_id,)
        ).fetchone()

        if not target:
            raise HTTPException(
                status_code=404,
                detail="Administrator not found"
            )

        if target["role"] != "admin":
            raise HTTPException(
                status_code=403,
                detail="Super Admin accounts cannot be deactivated"
            )

        if not target["is_active"]:
            raise HTTPException(
                status_code=400,
                detail="This administrator is already deactivated"
            )

        db.execute(
            "UPDATE users SET is_active = 0 WHERE id = ?",
            (admin_id,)
        )
        db.commit()

    return {
        "message": "Administrator deactivated successfully"
    }


@router.patch("/admins/{admin_id}/activate")
def activate_admin(
    admin_id: int,
    user=Depends(require_super_admin)
):
    with get_connection() as db:
        target = db.execute(
            "SELECT id, role, is_active FROM users WHERE id = ?",
            (admin_id,)
        ).fetchone()

        if not target:
            raise HTTPException(
                status_code=404,
                detail="Administrator not found"
            )

        if target["role"] != "admin":
            raise HTTPException(
                status_code=403,
                detail="Only regular administrator accounts can be activated here"
            )

        if target["is_active"]:
            raise HTTPException(
                status_code=400,
                detail="This administrator is already active"
            )

        db.execute(
            "UPDATE users SET is_active = 1 WHERE id = ?",
            (admin_id,)
        )
        db.commit()

    return {
        "message": "Administrator activated successfully"
    }
