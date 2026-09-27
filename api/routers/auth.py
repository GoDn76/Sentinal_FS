from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.database.connection import get_db
from api.database.models import User
from api.dependencies import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class RegisterResponse(BaseModel):
    user_id: str
    username: str
    email: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_211_CREATED if hasattr(status, "HTTP_211_CREATED") else 201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if username or email exists
    query = select(User).where((User.username == req.username) | (User.email == req.email))
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.username == req.username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "USERNAME_EXISTS", "detail": "Username is already registered"},
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "EMAIL_EXISTS", "detail": "Email is already registered"},
            )

    user = User(
        username=req.username,
        email=req.email,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return RegisterResponse(user_id=str(user.id), username=user.username, email=user.email)

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    query = select(User).where(User.username == req.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "INVALID_CREDENTIALS", "detail": "Invalid username or password"},
        )

    token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role}
    )
    return LoginResponse(access_token=token)
