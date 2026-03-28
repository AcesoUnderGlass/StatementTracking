from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import admin, articles, jurisdictions, people, quotes, review, stats, topics

app = FastAPI(title="AI Quote Tracker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(articles.router)
app.include_router(jurisdictions.router)
app.include_router(people.router)
app.include_router(quotes.router)
app.include_router(review.router)
app.include_router(stats.router)
app.include_router(topics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
