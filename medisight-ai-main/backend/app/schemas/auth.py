import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    # Optional: the login page lets the person pick which door they are
    # using. When present, the server refuses accounts of a different role
    # so a clinician can't accidentally sign in through the patient tab.
    role: Literal["patient", "clinician", "admin", "representative"] | None = None


class PatientRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # bcrypt only hashes the first 72 bytes, so cap the length instead of
    # silently truncating.
    password: str = Field(min_length=8, max_length=72)
    age: int = Field(ge=18, le=120)
    gender: Literal["Female", "Male", "Other"]
    region: str = Field(default="", max_length=64)

    @field_validator("full_name", "region")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must include at least one letter and one number")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class CurrentUser(BaseModel):
    id: int
    email: str
    role: str
    full_name: str
