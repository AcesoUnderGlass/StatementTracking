from fastapi import FastAPI

from .routes import admin, articles, jurisdictions, people, quotes, stats, topics

app = FastAPI(title="AI Quote Tracker", version="1.0.0")

app.include_router(admin.router)
app.include_router(articles.router)
app.include_router(jurisdictions.router)
app.include_router(people.router)
app.include_router(quotes.router)
app.include_router(stats.router)
app.include_router(topics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
