"""Existing REST routes plus a canonical catalog and local frontend."""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from catalog import ROOT, catalog_items, legacy_sneaker

app = FastAPI(
    title="Simple Sneaker API",
    description="The SOLE sneaker archive. Canonical products have exactly 14 attributes.",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to the Simple Sneaker API!",
        "endpoints": ["/sneakers", "/sneakers/{id}", "/sneakers/search"],
    }


@app.get("/sneakers")
def get_sneakers():
    sneakers = [legacy_sneaker(item) for item in catalog_items()]
    return {"count": len(sneakers), "sneakers": sneakers}


# Literal search path must precede the integer ID path.
@app.get("/sneakers/search")
def search_sneakers(q: str = Query(..., min_length=1)):
    query = q.strip().lower()
    if not query:
        raise HTTPException(status_code=422, detail="Search query must not be blank.")
    results = []
    for item in catalog_items():
        shoe = item["attributes"]
        searchable = " ".join(str(shoe[field]) for field in ("brand", "name", "year", "colorway")).lower()
        if query in searchable:
            results.append(legacy_sneaker(item))
    return {"query": query, "count": len(results), "results": results}


@app.get("/sneakers/{sneaker_id}")
def get_sneaker(sneaker_id: int):
    for item in catalog_items():
        if item["id"] == sneaker_id:
            return legacy_sneaker(item)
    raise HTTPException(status_code=404, detail="sneaker not found.")


@app.get("/catalog")
def get_catalog():
    items = catalog_items()
    return {"count": len(items), "items": items}


@app.get("/archive", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
def frontend():
    return FileResponse(ROOT / "index.html")


@app.get("/style.css", include_in_schema=False)
def stylesheet():
    return FileResponse(ROOT / "style.css", media_type="text/css")


@app.get("/app.js", include_in_schema=False)
def javascript():
    return FileResponse(ROOT / "app.js", media_type="text/javascript")


app.mount("/images", StaticFiles(directory=ROOT / "images"), name="images")
app.mount("/data", StaticFiles(directory=ROOT / "data"), name="data")
