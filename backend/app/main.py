
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, documents, signatures

# Initialize SQLite database
init_db()

app = FastAPI(
    title="SecureSign API",
    description="Backend for SecureSign electronic document signing",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://secure-sign.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(signatures.router)


@app.get("/")
def home():
    return {
        "message": "SecureSign Backend is running!",
        "status": "success"
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}
