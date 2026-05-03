import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import (
    admin,
    articles,
    favorites,
    jurisdictions,
    people,
    quotes,
    review,
    stats,
    topics,
    users,
)

app = FastAPI(title="AI Quote Tracker", version="1.0.0")


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if not raw:
        # Wide-open default keeps local dev frictionless when the env
        # isn't set; production deployments should always set this.
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(articles.router)
app.include_router(favorites.quote_router)
app.include_router(favorites.me_router)
app.include_router(jurisdictions.router)
app.include_router(people.router)
app.include_router(quotes.router)
app.include_router(review.router)
app.include_router(stats.router)
app.include_router(topics.router)
app.include_router(users.me_router)
app.include_router(users.admin_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
