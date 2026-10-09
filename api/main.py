from fastapi import FastAPI

app = FastAPI(title="Capstone API")


@app.get("/")
def root():
    return {"message": "Capstone API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}