import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import admin, articles, people, quotes, stats

app = FastAPI(title="AI Quote Tracker", version="1.0.0")

allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(articles.router)
app.include_router(people.router)
app.include_router(quotes.router)
app.include_router(stats.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
