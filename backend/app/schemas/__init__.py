
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional


# Authentication
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Documents
class DocumentResponse(BaseModel):
    id: int
    title: str
    filename: str
    status: str
    owner_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Signatures
class SignatureCreate(BaseModel):
    signer_name: str
    signature_text: str


class SignatureResponse(BaseModel):
    id: int
    document_id: int
    signer_name: str
    signed_at: datetime

    model_config = ConfigDict(from_attributes=True)
