from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from legacy.api.database import (
    create_account,
    get_user_by_id,
    update_display_name,
    validate_login,
)


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    email: str
    password: str


class SetDisplayNameRequest(BaseModel):
    value: str


app = FastAPI()

# Allow local development and private-network Vite origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=(
        r"http://("
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
        r"):5173"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Capstone Python API is running"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "online"}


@app.get("/api/test")
def test() -> dict[str, str]:
    return {
        "message": "Hello from Python!",
        "language": "Python",
    }


@app.get("/api/users/{user_id}")
def get_user(user_id: int) -> dict:
    # Translate the database layer's None result into an HTTP status so the
    # frontend can distinguish a missing account from a successful lookup.
    user = get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


@app.post("/api/auth/login")
def login(credentials: LoginRequest) -> dict[str, int]:
    user_id = validate_login(
        credentials.email.strip().lower(),
        credentials.password
    )

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    return {"User_ID": user_id}


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest) -> dict[str, int]:
    username = request.username.strip()
    email = request.email.strip().lower()

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty.",
        )

    user_id = create_account(
        username=username,
        email=email,
        password=request.password,
    )
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this username or email already exists.",
        )

    return {"User_ID": user_id}


@app.put("/api/users/{user_id}/display-name")
def set_display_name(
    user_id: int,
    request: SetDisplayNameRequest
) -> dict[str, str | bool]:
    # Validate and normalize input at the API boundary; database.py only owns
    # persistence and reports whether the target user row existed.
    display_name = request.value.strip()

    if not display_name:
        raise HTTPException(
            status_code=400,
            detail="Display name cannot be empty."
        )

    if len(display_name) > 100:
        raise HTTPException(
            status_code=400,
            detail="Display name cannot exceed 100 characters."
        )

    success = update_display_name(user_id, display_name)

    if not success:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "success": True,
        "displayName": display_name
    }

