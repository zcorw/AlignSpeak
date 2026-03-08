from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)


class RegisterResponse(BaseModel):
    user_id: str
    message: str
    verification_required: bool
    verification_code: str | None = None


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class VerifyEmailResponse(BaseModel):
    user_id: str
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MeResponse(BaseModel):
    user_id: str
    email: str
    role: str
    display_name: str
    status: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordResponse(BaseModel):
    message: str
