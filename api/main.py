from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Capstone API")

# Allow the Vite development server to communicate with the API.
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
    return {"message": "Capstone API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/test")
def test():
    return {
        "message": "Hello from Python!",
        "language": "Python",
    }