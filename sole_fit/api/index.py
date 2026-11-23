"""Sole Fit sizing API and frontend backed by the shared Archive catalog."""
import json
import os
import re
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

if __package__ == 'sole_fit.api':
    from ..archive_catalog import ArchiveCatalog, CatalogUnavailable, archive_origin, preview_stats
    from ..fit_engine import US_TO_EU, fit_profile, recommend
else:
    from archive_catalog import ArchiveCatalog, CatalogUnavailable, archive_origin, preview_stats
    from fit_engine import US_TO_EU, fit_profile, recommend

ROOT = Path(__file__).resolve().parents[1]
WIDTH_RATINGS = Literal['narrow', 'standard', 'wide']
# File-opened frontends send the literal Origin: null.
DEFAULT_ORIGINS = ','.join(f'http://{host}:{port}' for host in ('localhost', '127.0.0.1')
                         for port in (3000, 5173, 5500, 8080, 8000, 8002)) + ',null'


def create_app(catalog=None):
    database = ArchiveCatalog() if catalog is None else catalog
    origins = [origin.strip() for origin in os.environ.get('SOLE_FIT_CORS_ORIGINS', DEFAULT_ORIGINS).split(',') if origin.strip()]

    app = FastAPI(title='SoleFit API', version='1.0',
                  description='Fit estimates using the shared Supabase sneaker catalog.')

    @app.exception_handler(CatalogUnavailable)
    async def database_error(request, error):
        return JSONResponse(status_code=503, content={"detail": "Catalog unavailable. Please try again later."})

    app.state.database = database
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                       allow_methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization'])

    def sneaker(sneaker_id):
        item = database.sneaker(sneaker_id)
        if item is None:
            raise HTTPException(404, 'Sneaker not found in the active catalog.')
        return item

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'SoleFit', 'catalog_count': len(database.catalog())}

    @app.get('/api/catalog')
    def catalog():
        items = database.catalog()
        return {'count': len(items), 'items': items}

    @app.get('/api/fit/sizes')
    def sizes():
        return {'us_men': list(US_TO_EU), 'us_women': [size + 1.5 for size in US_TO_EU], 'eu': list(US_TO_EU.values())}

    @app.get('/api/fit/recommend')
    def recommendation(reference_shoe_id: Annotated[int, Query(gt=0)], reference_size: Annotated[float, Query(gt=0, allow_inf_nan=False)],
                       target_shoe_id: Annotated[int, Query(gt=0)], size_system: Literal['us_men', 'us_women', 'eu'] = 'us_men',
                       foot_width: WIDTH_RATINGS = 'standard'):
        left, right = sneaker(reference_shoe_id), sneaker(target_shoe_id)
        try:
            return recommend(left, right, reference_size, size_system, foot_width,
                             preview_stats(left['id']), preview_stats(right['id']))
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.get('/api/sneakers/{sneaker_id}/fit-stats')
    def statistics(sneaker_id: int):
        item = sneaker(sneaker_id)
        stats = preview_stats(sneaker_id)
        return {**stats, 'profile': fit_profile(item, stats)}

    @app.get('/api/sneakers/{sneaker_id}')
    def detail(sneaker_id: int):
        return sneaker(sneaker_id)

    @app.post("/api/fit/feedback")
    def feedback_unavailable():
        raise HTTPException(503, "Community feedback submissions are disabled in preview mode.")

    @app.get('/', include_in_schema=False)
    @app.get('/index.html', include_in_schema=False)
    def frontend():
        return FileResponse(ROOT / 'index.html', headers={'Cache-Control': 'no-store'})

    @app.get('/config.js', include_in_schema=False)
    def frontend_config(request: Request):
        prefix = request.scope.get("root_path", "")
        config = json.dumps({"apiOrigin": prefix, "archiveOrigin": archive_origin() if not prefix else None})
        origin = "config.archiveOrigin ||= window.location.origin;" if prefix else ""
        return Response(f"{{ const config = {config}; {origin} window.SOLE_FIT_CONFIG = Object.freeze(config); }}", media_type="text/javascript",
                        headers={"Cache-Control": "no-store"})

    @app.get('/{filename}', include_in_schema=False)
    def frontend_asset(filename: str):
        if filename == "sole-account-config.js":
            config = json.dumps({
                "url": os.environ.get("SOLE_SUPABASE_URL", "https://xwqdcqpxjjctwugbssqr.supabase.co"),
                "key": os.environ.get("SOLE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_dn4hmTlJBFuQviEoTJ45BA_SWZQkIV5"),
            })
            return Response(f"window.SOLE_ACCOUNT_CONFIG = {config};", media_type="text/javascript",
                            headers={"Cache-Control": "no-store"})
        if filename == "sole-account-images":
            archive_images = ROOT.parent / "my_fastapi_service_sole_list" / "images"
            if not archive_images.is_dir():
                raise HTTPException(503, "Image inventory unavailable.")
            return [f"images/{path.name}" for path in sorted(archive_images.iterdir())
                    if path.is_file() and re.fullmatch(r"[\w.-]+\.(jpg|jpeg|png|webp|avif)", path.name, re.I)]
        if filename not in {'app.js', 'components.js', 'community.js', 'style.css'}:
            raise HTTPException(404, 'File not found.')
        return FileResponse(ROOT / filename, headers={'Cache-Control': 'no-store'})

    app.mount('/images', StaticFiles(directory=ROOT / 'images'), name='catalog-images')
    account_assets = ROOT.parent / "sole_shared"
    if account_assets.is_dir():
        app.mount("/sole-shared", StaticFiles(directory=account_assets), name="sole-shared")
    return app


app = create_app()
