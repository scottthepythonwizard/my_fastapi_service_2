# Sole Supabase integration

Sole Archive owns the sneaker API. Sole Fit requests the same catalog for sizing and Sole Compare uses it to build comparisons. The Supabase project `xwqdcqpxjjctwugbssqr` contains the 20 original sneakers with their original IDs, images, and provenance. Community voting remains in preview mode with zero votes and submissions disabled.

## Run the local demo

1. Open `START_SOLE.cmd`. It checks the shared catalog, opens all three sites, and leaves the local services running in the background. Run it again after restarting Windows. The workspace already has a private `.env` and the Python environment on this machine.
2. Use [Archive](http://127.0.0.1:8000/archive), [Fit](http://127.0.0.1:8000/fit/), or [Compare](http://127.0.0.1:8000/compare/). The launcher serves all three on port 8000, so browser requests for the catalog, fit recommendations, and product images use the same origin.
3. Open [Archive API docs](http://127.0.0.1:8000/docs) to exercise the endpoints. For reads, authorize with the configured catalog read key. For writes, use the bearer token from your private `.env`. To try a create, use the `attributes` object from an existing `GET /api/v1/catalog/1` response, change the name and reference number, and submit it as the body. Use the returned ID for PATCH and DELETE.

For another Windows checkout, create the Archive environment with `python -m venv my_fastapi_service_sole_list/.venv`. Install dependencies with `my_fastapi_service_sole_list/.venv/Scripts/python.exe -m pip install -r my_fastapi_service_sole_list/requirements.txt -r sole_fit/requirements.txt`. Install Node.js 20 or later. Copy `.env.example` to `.env` and set the runtime role's Supabase transaction pooler URL and a randomly generated admin token. Keep both values private. Use the project dashboard's Connect panel for the pooler host and the username format `sole_catalog_api.<project-ref>`. If provisioning a different project, apply the migration once and set a password for the dedicated login role through a secure administrator session before starting the API.

## Request flow and data model

```text
Sole Compare browser ──────────┐
Sole Fit browser ───────────────┼→ Archive FastAPI → psycopg / Supavisor → sole.sneakers
Sole Archive browser ──────────┘
Admin API client ─── bearer token → Archive write routes ────────────────┘
```

- Archive's list, detail, search, catalog, and compatibility reads previously loaded local files. They keep their existing routes, read key, and response shapes and now query Supabase.
- Archive adds `POST /api/v1/sneakers` with status 201, `PATCH /api/v1/sneakers/{id}` with the revised record, and `DELETE /api/v1/sneakers/{id}` with status 204.
- Locally, Fit uses Archive’s catalog repository in the same process, and Compare requests Archive’s API on the same origin. A standalone Fit deployment uses the configured Archive API. Sizing and preview statistics use the existing calculations.

```text
sole.sneakers
  id                     integer identity, primary key
  shoe_reference_number  text, required and unique
  sneaker attributes     typed text, integer, and floating-point columns
  image_url, image_note  text, relative image path and caption
  provenance             JSONB object, research notes and source links
```

Each row holds a complete sneaker. The catalog has no dependent database tables. PostgreSQL stores undocumented years as null and Archive returns the existing `Not documented` label. Weight and release month may be absent. The seed lives in `supabase/migrations/20261105145922_sole_catalog.sql`. Catalog files are retained for seed provenance and tests. Images are served by Archive.

## Access and failure behavior

- PostgreSQL is in a private schema with row-level security. The runtime role can read and write the sneaker table and use the ID sequence. Supabase's `anon` and `authenticated` roles lack table access.
- FastAPI uses a separate bearer token for writes. The compatibility read key is browser-visible and grants access to the catalog reads. Both the role password and admin token live in the ignored `.env` or in hosting secrets.
- The driver verifies the pooler certificate and hostname using the public Supabase CA. The service uses parameterized statements and timeouts. A partial update sends only supplied fields to PostgreSQL.
- The API returns 401 for missing or invalid credentials, 404 for absent records, 409 for a duplicate reference, 422 for invalid input, and a generic 503 when it cannot reach the database. Health endpoints check the live catalog.

## Verified results

- A TLS-verified connection as the runtime role returned 20 rows. All 20 IDs, attributes, images, and provenance matched the original Archive catalog. Supabase reported no security or performance advisory findings.
- A temporary row was created through the API and confirmed in SQL. A partial update preserved omitted fields and the revised row appeared in all three sites in Chrome. Fit calculated a size and Compare rendered a two-shoe comparison.
- The updated row remained after restarting Archive. The API then deleted it, SQL confirmed its absence, and a second restart preserved the deletion. Supabase finished with the 20 original records.
- Malformed JSON, missing fields, invalid data types and values, duplicate references, missing IDs, and unauthorized writes returned the expected errors. A simulated database outage returned a sanitized 503.

The Windows launcher and all six Compare live tests passed against Supabase. The shared FastAPI application is now deployed to Vercel at `https://my-fastapi-service-2.vercel.app`. Production uses the root `app.py` entry point, Python 3.12, and the Singapore function region. Archive, Fit, and Compare share this origin.

The production deployment stores `SOLE_DATABASE_URL` and `SOLE_ADMIN_TOKEN` as Vercel secrets. Phase 7 verification exercises HTTPS API requests, directly checks the corresponding Supabase rows, and redeploys the API to confirm persistence. Local evidence files are saved under `output/phase7/`. Source pushes to the GitHub `main` branch trigger Vercel production builds.

References: [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase TLS configuration](https://supabase.com/docs/guides/platform/ssl-enforcement), [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi).
