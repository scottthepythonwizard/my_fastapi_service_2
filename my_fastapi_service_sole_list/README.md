# SOLE. Sneaker archive

**Supabase migration:** this checkout now uses hosted PostgreSQL for its runtime catalog.
See `../README_SUPABASE.md` for setup, startup and verification. JSON files are
backup/import inputs; restarting the API no longer reloads a JSON snapshot.
The current API, auth, all 20 attributes and Compare integration are preserved.

The earlier file-based workflow below remains as historical import guidance.


A sneaker archive with a versioned FastAPI backend, 20 typed product attributes, startup validation, a public health check, and header-based API-key authentication.

The standalone **Sole Compare** frontend lives in `sole_compare/`. It consumes the same API and images to compare two distinct pairs across 14 aligned attributes, using an exact copy of this Archive's base stylesheet. See `sole_compare/README.md` for component details and PowerShell commands to install it in Documents and run on port 5173.

## Run locally

From this directory, with Python 3.10 or newer:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.index:app --reload
```

Open http://127.0.0.1:8000/archive for the frontend, `/docs` for Swagger UI, and `/health` for public health information. The original `uvicorn index22:app` entry point uses the same application. `api/index_v1_backup.py` is an unchanged backup of the original API file created before refactoring; `.vercelignore` excludes that unauthenticated backup from deployments.

## API configuration and authentication

`API_VERSION = "1.0"` controls the OpenAPI and health version. Data routes use the `/api/v1` prefix. `API_KEY` reads `SOLE_API_KEY` from the environment and defaults to the classroom example `student-api-key-123`. Blank environment keys are rejected at startup.

In `/docs`, click **Authorize**, enter `student-api-key-123`, and authorize. Missing or wrong `x-api-key` headers return HTTP 401 with `Invalid or missing API key.` Existing unversioned data routes remain as authenticated compatibility aliases, hidden from Swagger.

```powershell
$headers = @{ 'x-api-key' = 'student-api-key-123' }
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/sneakers -Headers $headers
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/sneakers/search?q=United%20States' -Headers $headers
Invoke-RestMethod http://127.0.0.1:8000/api/v1/sneakers/1 -Headers $headers
```

To change the server key, set `$env:SOLE_API_KEY = 'your-key'` before starting the server (or set that environment variable in Vercel and redeploy). Configure the matching frontend key as described below. Browser-delivered API keys are visible to visitors; the classroom key demonstrates header authentication and is not a secret suitable for protecting private production data. A production application needs server-side credential handling or user authentication.

## Routes

- `GET /`: welcome message and route links, public.
- `GET /health`: `{status, service, version, timestamp}`, public; timestamp is UTC ISO 8601 ending in `Z`.
- `GET /api/v1/sneakers`: `{count, sneakers}`; each sneaker has the 20 attributes plus `id`, `model`, and `price` compatibility fields.
- `GET /api/v1/sneakers/search?q=...`: `{query, count, results}`; case-insensitive substring search across all attributes, including country, category, materials, construction, cushioning, and descriptions. Leading/trailing whitespace is trimmed; missing or blank queries return 422.
- `GET /api/v1/sneakers/{sneaker_id}`: one sneaker, or 404 if missing.
- `GET /api/v1/catalog`: `{count, items}`; each item contains `id`, `image_url`, `image_note`, `attributes`, and `provenance`.
- `GET /api/v1/catalog/{sneaker_id}`: one catalog item with its media and provenance.

All data routes above require `x-api-key`. Compatibility aliases `/sneakers`, `/sneakers/search`, `/sneakers/{id}`, `/catalog`, and `/catalog/{id}` require the same header. `/data/sneakers.json`, `/data/images.json`, and `/data/provenance.json` are also authenticated so the JSON snapshot does not bypass the API check. Frontend assets and images remain public. CORS permits GET/OPTIONS and the `x-api-key` header from explicit local frontend origins: `http://localhost` and `http://127.0.0.1` on ports 3000, 5173, 5500, and 8080. Set `SOLE_CORS_ORIGINS` to a comma-separated list of exact origins (no trailing slash) before starting uvicorn to replace these defaults for custom ports or hosted frontends.

## Twenty validated attributes

The `SneakerAttributes` Pydantic model is defined in `catalog.py`. All 20 keys must be present in each saved record:

```text
brand
name
year
descriptive_overview
gender_target
retail_price
colorway
description
category
details_specifications
shoe_reference_number
review_stars
materials
country_of_origin
closure_type
cut
sole_material
cushioning
weight_g
release_month
```

IDs, image paths, notes, and provenance stay outside the attributes. The model rejects extra fields and coerced string numbers. Text is trimmed and must be nonempty. Ratings must be finite numbers from 0 to 5; weight must be a positive finite number or null; release month must be an integer from 1 to 12 or null. Gender accepts Men/Women/Both; category accepts Basketball/Running/Lifestyle/Football. Closure accepts Lace-up/Laceless/Slip-on/Hook-and-loop/Not documented; cut accepts Low/Mid/High/Not documented.

All 20 archived pairs have closure, cut, sole material, cushioning, weight, and release month populated. Construction comes from manufacturer specifications and supplied photographs; inferred construction is labeled Estimated. Weights are per shoe: adidas publishes approximately 224 g at UK 8.5 for the EVO SL; other weights are realistic model/category estimates for men's US 9 (women's US 8 for V2K Run), visibly labeled Estimated. These are not measurements of the pictured pairs.

Release months display as month names, with the reference-edition year when available. The existing archive year may describe the original silhouette instead: e.g. Air Jordan 1 retains 1985 while its reference edition shows May 2015. Manufacturer announcements and retailer release listings are recorded in `data/provenance.json`. Where a specific month cannot be established, the catalog uses an explicitly labeled seasonal estimate with its assumption; this is not a verified historical launch date. Existing PHP retail references and reviewed photo colorways are retained.

At application startup, all saved records, complete field sets, positive IDs, and image paths are validated before requests are served. Invalid data prevents startup. The API serves that validated snapshot; restart the server after changing inventory data.

## Authenticated frontend

`app.js` defaults to the same-origin `/api/v1` API and the classroom key. Its shared `FETCH_OPTIONS` attaches `x-api-key` to catalog, detail, and bundled-data requests. Search covers the same 20 attributes as the API. Product details use the authenticated `/api/v1/catalog/{id}` endpoint and render all additional metadata.

When the API is hosted separately, place configuration before the existing deferred `app.js` script in `index.html`:

```html
<script>
  window.SOLE_API_URL = "https://your-project.vercel.app";
  window.SOLE_API_KEY = "student-api-key-123";
</script>
```

Use the deployment origin without `/api/v1`; the script adds the prefix and removes a trailing slash. Images and fallback data remain local to the frontend. Opening `index.html` through `file://` prevents JSON requests; use the FastAPI server or an HTTP static server.

A network/API outage can use the bundled archive. A 401 authentication failure displays an API-key error and never triggers snapshot fallback. On FastAPI hosting the snapshots also require the key. Static-only hosting (`python -m http.server 8080`) intentionally publishes its files and does not provide API authentication.

## Update the inventory

Product photos use stable positive numeric filenames such as `images/21.jpg`; supported formats are JPG, JPEG, PNG, WebP, and AVIF. The editorial image is named `hero` with a supported extension.

Add a complete record and its photo, then run:

```powershell
.\.venv\Scripts\python.exe scripts\sync_inventory.py
```

New images without records receive explicit placeholder metadata from the model defaults. Saved partial records fail validation. The sync script writes the static inventory and merged provenance. Missing photos, duplicate IDs, or unsupported image names fail explicitly. Remove both a record and its photo to remove a pair, then sync and restart the server.

`data/provenance.json` retains source notes, estimate assumptions, and mock/unverified/provided flags. The reference row displays only the reference number and Source link, with no SKU badge or commentary. For unverified reference numbers, the link points to a model source and its tooltip identifies that scope; API provenance retains the unverified status. Demonstration ratings remain labeled. Country of Origin retains the user-supplied value without claiming a verified manufacturing location. `scripts/import_reference.py` preserves reviewed colorways, extended metadata, and the corresponding evidence when reimporting.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
node --check app.js
node tests/frontend.cjs
```

Backend tests cover schema constraints, startup rejection, complete specifications and evidence for all 20 pairs, image inventory, authenticated versioned and compatibility routes, public health/docs, Swagger authorization, expanded search, and authenticated CORS. Frontend regression checks cover all 20 specification sheets, estimate labels, reference-only source rows, headers, and 401 snapshot fallback prevention.

With a server running and Playwright installed, `node tests/browser.cjs` covers the full archive, all 20 modals, filters, sorting, focus, fallback/retry, and mobile overflow. Set `SOLE_TEST_URL`, `SOLE_API_KEY`, and `SOLE_BROWSER` as needed. Browser screenshots are saved in `screenshots/`.
