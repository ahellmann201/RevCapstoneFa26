import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from test_database.connection import get_connection as get_test_connection
from test_database.login import validate_login
from api.database import get_user_by_id
from api.config import APP_ENV

class LoginRequest(BaseModel):
    email: str
    password: str

app = FastAPI()

# Allow requests from the Vite development server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Capstone Python API is running"}


@app.get("/api/health")
def health():
    return {"status": "online"}


@app.get("/api/test")
def test():
    return {
        "message": "Hello from Python!",
        "language": "Python",
    }


@app.get("/api/users/{user_id}")
def get_user(user_id: int):
    user = get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user

@app.post("/api/auth/login")
def login(credentials: LoginRequest):
    user_id = validate_login(
        credentials.email,
        credentials.password
    )

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    return {"User_ID": user_id}