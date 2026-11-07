"""Versioned, authenticated sneaker API and the SOLE archive frontend."""
from datetime import datetime, timezone
import json
import os
import re
import secrets
import sys
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response, Security, Path as PathParameter
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, create_model

from catalog import ROOT, SneakerAttributes, legacy_sneaker
from catalog_repository import CatalogRepository, DatabaseUnavailable, DuplicateReference

# The default is a public classroom key. Set SOLE_API_KEY for other environments.
API_KEY = os.environ.get("SOLE_API_KEY", "student-api-key-123")
API_VERSION = "1.0"
WORKSPACE = ROOT.parent
COMPARE_SITE = WORKSPACE / "sole_compare_final"
LOCAL_SITES = (WORKSPACE / "sole_fit/api/index.py").is_file() and (COMPARE_SITE / "index.html").is_file()
CORS_ORIGINS = [origin.strip() for origin in os.environ.get(
    "SOLE_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5500,http://127.0.0.1:5500,"
    "http://localhost:8080,http://127.0.0.1:8080,"
    "http://localhost:8002,http://127.0.0.1:8002",
).split(",") if origin.strip()]
if not API_KEY.strip():
    raise ValueError("SOLE_API_KEY must not be blank")


class Sneaker(SneakerAttributes):
    id: Annotated[int, Field(gt=0)]
    model: str
    price: str


class CatalogItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: Annotated[int, Field(gt=0)]
    image_url: str
    image_note: str
    attributes: SneakerAttributes
    provenance: dict[str, Any]


class SneakerList(BaseModel):
    count: int
    sneakers: list[Sneaker]


class SearchResults(BaseModel):
    query: str
    count: int
    results: list[Sneaker]


class CatalogList(BaseModel):
    count: int
    items: list[CatalogItem]


class CatalogWriteFields(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    image_url: Annotated[str, Field(min_length=1)] = "images/hero.jpg"
    image_note: str = ""
    provenance: dict[str, Any] = Field(default_factory=dict)

    @field_validator("image_url")
    @classmethod
    def valid_image_url(cls, value):
        if re.fullmatch(r"images/[\w.-]+\.(?:jpg|jpeg|png|webp|avif)", value, re.IGNORECASE) and (ROOT / value).is_file():
            return value
        raise ValueError("Use the path of an existing image under images/.")


OPTIONAL_ATTRIBUTES = {"weight_g", "release_month"}
SneakerCreate = create_model(
    "SneakerCreate", __base__=(CatalogWriteFields, SneakerAttributes),
    **{name: (field.rebuild_annotation(), ...) for name, field in SneakerAttributes.model_fields.items()
       if name not in OPTIONAL_ATTRIBUTES},
)


class PatchFields(CatalogWriteFields):
    @model_validator(mode="after")
    def validate_patch(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update.")
        if any(getattr(self, field) is None for field in self.model_fields_set - OPTIONAL_ATTRIBUTES):
            raise ValueError("Only weight_g and release_month accept null.")
        return self


SneakerPatch = create_model(
    "SneakerPatch", __base__=PatchFields,
    **{name: (field.rebuild_annotation(), None) for name, field in SneakerAttributes.model_fields.items()},
)
SneakerId = Annotated[int, PathParameter(gt=0, le=2147483647)]


app = FastAPI(title="Simple Sneaker API", version=API_VERSION)
app.state.database = CatalogRepository()
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["x-api-key", "Content-Type", "Authorization"],
)

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


def verify_api_key(x_api_key: str | None = Security(api_key_header)):
    if x_api_key is None or not secrets.compare_digest(x_api_key.encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    return True


def repository(request: Request):
    return request.app.state.database


def validated_items(database=Depends(repository)):
    return database.list()


def require_admin(credentials: Annotated[HTTPAuthorizationCredentials | None, Security(HTTPBearer(auto_error=False))]):
    expected = os.environ.get("SOLE_ADMIN_TOKEN")
    if not expected:
        raise HTTPException(503, "Catalog writes are unavailable.")
    if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), expected.encode()):
        raise HTTPException(401, "Invalid or missing admin token.", headers={"WWW-Authenticate": "Bearer"})



@app.get("/")
def home():
    return {
        "message": "Welcome to the Simple Sneaker API!",
        "endpoints": ["/health", "/docs", "/api/v1/sneakers", "/api/v1/sneakers/search", "/api/v1/sneakers/{id}", "/api/v1/catalog"],
    }


@app.get("/health", tags=["Health"])
def health_check(database=Depends(repository)):
    return {
        "status": "ok", "service": "Simple Sneaker API", "version": API_VERSION,
        "catalog_count": database.count(),
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


router = APIRouter(dependencies=[Depends(verify_api_key)], tags=["Sneakers"])


@router.get("/sneakers", response_model=SneakerList)
def get_sneakers(items: list = Depends(validated_items)):
    sneakers = [legacy_sneaker(item) for item in items]
    return {"count": len(sneakers), "sneakers": sneakers}


# Register the literal search path before the integer ID path.
@router.get("/sneakers/search", response_model=SearchResults)
def search_sneakers(q: str = Query(..., min_length=1), items: list = Depends(validated_items)):
    query = q.strip().lower()
    if not query:
        raise HTTPException(status_code=422, detail="Search query must not be blank.")
    results = []
    for item in items:
        searchable_text = " ".join(str(value) for value in item["attributes"].values() if value is not None).lower()
        if query in searchable_text:
            results.append(legacy_sneaker(item))
    return {"query": query, "count": len(results), "results": results}


def require_item(item):
    if item is None:
        raise HTTPException(status_code=404, detail="Sneaker not found.")
    return item


@router.get("/sneakers/{sneaker_id}", response_model=Sneaker)
def get_sneaker(sneaker_id: SneakerId, database=Depends(repository)):
    return legacy_sneaker(require_item(database.get(sneaker_id)))


@router.get("/catalog", response_model=CatalogList)
def get_catalog(items: list = Depends(validated_items)):
    return {"count": len(items), "items": items}


@router.get("/catalog/{sneaker_id}", response_model=CatalogItem)
def get_catalog_item(sneaker_id: SneakerId, database=Depends(repository)):
    return require_item(database.get(sneaker_id))


app.include_router(router, prefix="/api/v1")
# Existing clients retain their routes, but must also provide the key.
app.include_router(router, include_in_schema=False)


writes = APIRouter(prefix="/api/v1", dependencies=[Depends(require_admin)], tags=["Sneakers"])


@writes.post("/sneakers", status_code=201, response_model=Sneaker)
def create_sneaker(body: SneakerCreate, database=Depends(repository)):
    return legacy_sneaker(database.create(body.model_dump()))


@writes.patch("/sneakers/{sneaker_id}", response_model=Sneaker)
def update_sneaker(sneaker_id: SneakerId, body: SneakerPatch, database=Depends(repository)):
    return legacy_sneaker(require_item(database.update(sneaker_id, body.model_dump(exclude_unset=True))))


@writes.delete("/sneakers/{sneaker_id}", status_code=204)
def delete_sneaker(sneaker_id: SneakerId, database=Depends(repository)):
    if not database.delete(sneaker_id):
        raise HTTPException(404, "Sneaker not found.")
    return Response(status_code=204)


app.include_router(writes)



@app.get("/archive", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
def frontend():
    return FileResponse(ROOT / "index.html")


@app.get("/config.js", include_in_schema=False)
def frontend_config():
    fit_origin = json.dumps("/fit" if LOCAL_SITES else os.environ.get("SOLE_FIT_ORIGIN", "http://127.0.0.1:8002"))
    read_key = json.dumps(API_KEY)
    return Response(f"window.SOLE_FIT_ORIGIN = {fit_origin}; window.SOLE_API_KEY = {read_key};",
                    media_type="text/javascript", headers={"Cache-Control": "no-store"})


@app.get("/style.css", include_in_schema=False)
def stylesheet():
    return FileResponse(ROOT / "style.css", media_type="text/css")


@app.get("/app.js", include_in_schema=False)
def javascript():
    return FileResponse(ROOT / "app.js", media_type="text/javascript")


@app.get("/fit-community.js", include_in_schema=False)
def fit_community_component():
    return FileResponse(ROOT / "fit-community.js", media_type="text/javascript")


@app.get("/data/{filename}", dependencies=[Depends(verify_api_key)], include_in_schema=False)
def bundled_data(filename: str, items: list = Depends(validated_items)):
    if filename == "sneakers.json":
        return {str(item["id"]): item["attributes"] for item in items}
    if filename == "images.json":
        return {"hero": "images/hero.jpg", "items": {str(item["id"]):
                {"image": item["image_url"], "note": item["image_note"]} for item in items}}
    if filename == "provenance.json":
        return {str(item["id"]): item["provenance"] for item in items}
    raise HTTPException(status_code=404, detail="Data file not found.")


@app.exception_handler(DatabaseUnavailable)
async def database_error(request, error):
    return JSONResponse(status_code=503, content={"detail":"Database unavailable. Please try again later."})


@app.exception_handler(DuplicateReference)
async def duplicate_reference(request, error):
    return JSONResponse(status_code=409, content={"detail": "Shoe reference number already exists."})


@app.exception_handler(RequestValidationError)
async def invalid_request(request, error):
    details = [{key: item[key] for key in ("loc", "msg", "type")} for item in error.errors()]
    return JSONResponse(status_code=422, content={"detail": details})


app.mount("/images", StaticFiles(directory=ROOT / "images"), name="images")

if LOCAL_SITES:
    # The local workspace contains all three apps. An Archive-only deployment can still run independently.
    sys.path.append(str(WORKSPACE))
    from sole_fit.api.index import create_app as create_fit_app

    class FitCatalog:
        def catalog(self):
            return app.state.database.list()

        def sneaker(self, identity):
            return app.state.database.get(identity)

    fit_app = create_fit_app(FitCatalog())
    fit_app.add_exception_handler(DatabaseUnavailable, database_error)
    app.mount("/fit", fit_app, name="fit")

    @app.get("/compare/config.js", include_in_schema=False)
    def compare_config():
        key = json.dumps(API_KEY)
        return Response(
            "window.SOLE_COMPARE_CONFIG = Object.freeze({apiOrigin: window.location.origin, "
            f"apiKey: {key}, fitOrigin: window.location.origin, fitPath: '/fit/'}});",
            media_type="text/javascript", headers={"Cache-Control": "no-store"},
        )

    @app.get("/compare/", include_in_schema=False)
    def compare_frontend():
        return FileResponse(COMPARE_SITE / "index.html", headers={"Cache-Control": "no-store"})

    @app.get("/compare/{filename}", include_in_schema=False)
    def compare_asset(filename: str):
        if filename not in {"index.html", "app.js", "components.js", "core.js", "style.css", "archive.css"}:
            raise HTTPException(404, "File not found.")
        return FileResponse(COMPARE_SITE / filename, headers={"Cache-Control": "no-store"})
