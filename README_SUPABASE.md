# Sole Supabase integration

Sole Archive owns the sneaker API. Sole Fit requests the same catalog for sizing and Sole Compare uses it to build comparisons. The Supabase project `xwqdcqpxjjctwugbssqr` contains the 20 original sneakers with their original IDs, images, and provenance. Community voting remains in preview mode with zero votes and submissions disabled.

## Run the local demo

1. Download or clone the complete repository and extract it if needed. On Windows with Python 3.12 installed, open `START_SOLE.cmd` from the root. On the first run it creates a Python environment and installs the required packages. It then checks the shared catalog and opens all three sites. Run it again after restarting Windows.
2. Use [Archive](http://127.0.0.1:8000/archive), [Fit](http://127.0.0.1:8000/fit/), or [Compare](http://127.0.0.1:8000/compare/). The launcher serves all three on port 8000, so browser requests for the catalog, fit recommendations, and product images use the same origin.
3. Open [Archive API docs](http://127.0.0.1:8000/docs) to exercise the endpoints. For reads, authorize with the configured catalog read key. For writes, use the bearer token from your private `.env`. To try a create, use the `attributes` object from an existing `GET /api/v1/catalog/1` response, change the name and reference number, and submit it as the body. Use the returned ID for PATCH and DELETE.

On a lab computer, leave `.env` absent. The launcher uses the public catalog on the hosted SOLE API for reads and your Supabase account for favorites. First-time dependency installation and normal use require internet access.

Use **Sign in** on any site with an existing SOLE Supabase email/password account. The launcher serves all three sites under one browser origin, so their login and favorites list are shared. Use the star to save or remove a sneaker. Fit saves the selected reference size or displayed recommendation and offers **Update size** for a saved sneaker. Use **Account → Sign out** when finished on a shared computer.

For a separate development database, apply the favorite sizes migration after the consolidated catalog and configure both `SOLE_SUPABASE_URL` and `SOLE_SUPABASE_PUBLISHABLE_KEY` plus the matching catalog connection.

A private developer checkout can still use `.env` with the runtime pooler URL and API write token. Keep those credentials on trusted machines or in hosting secrets.

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

Each row holds a complete sneaker. `public.favorites` references sneaker IDs and adds an optional numeric size and sizing system to the existing user/sneaker pair. PostgreSQL stores undocumented years as null and Archive returns the existing `Not documented` label. Weight and release month may be absent. Catalog files are retained for seed provenance and tests. Images are served by Archive.

## Access and failure behavior

- The Data API exposes the `sole` schema. Its row-level policies allow signed-in catalog reads and restrict browser CRUD to administrators. The dedicated backend role can access the sneaker table and its ID sequence. Supabase's `anon` role cannot access the sneaker or favorites tables directly. Favorites policies confine reads and writes to each owner, and clients can only update the size columns on saved rows.
- FastAPI uses a separate bearer token for writes. The compatibility read key is browser-visible and grants access to the catalog reads. Both the role password and admin token live in the ignored `.env` or in hosting secrets.
- The driver verifies the pooler certificate and hostname using the public Supabase CA. The service uses parameterized statements and timeouts. A partial update sends only supplied fields to PostgreSQL.
- The API returns 401 for missing or invalid credentials, 404 for absent records, 409 for a duplicate reference, 422 for invalid input, and a generic 503 when it cannot reach the database. Health endpoints check the live catalog.

## Verified results

To repeat the favorites size tests in a disposable local database, run
`npm ci --prefix supabase/tests`, then `npm test --prefix supabase/tests`.
With Chrome installed and the launcher’s Python environment available, run
`npm run test:browser --prefix supabase/tests`. The Chrome suite opens all
three actual pages, uses local PostgreSQL policies, and supplies synthetic
Auth sessions through a test gateway. It does not require private credentials.

- A TLS-verified connection as the runtime role returned 20 rows. All 20 IDs, attributes, images, and provenance matched the original Archive catalog. Supabase reported no security or performance advisory findings.
- A temporary row was created through the API and confirmed in SQL. A partial update preserved omitted fields and the revised row appeared in all three sites in Chrome. Fit calculated a size and Compare rendered a two-shoe comparison.
- The updated row remained after restarting Archive. The API then deleted it, SQL confirmed its absence, and a second restart preserved the deletion. Supabase finished with the 20 original records.
- Malformed JSON, missing fields, invalid data types and values, duplicate references, missing IDs, and unauthorized writes returned the expected errors. A simulated database outage returned a sanitized 503.

The Windows launcher and all six Compare live tests passed against Supabase. The shared FastAPI application is now deployed to Vercel at `https://my-fastapi-service-2.vercel.app`. Production uses the root `app.py` entry point, Python 3.12, and the Singapore function region. Archive, Fit, and Compare share this origin.

The production deployment stores `SOLE_DATABASE_URL` and `SOLE_ADMIN_TOKEN` as Vercel secrets. Phase 7 verification exercises HTTPS API requests, directly checks the corresponding Supabase rows, and redeploys the API to confirm persistence. Local evidence files are saved under `output/phase7/`. Source pushes to the GitHub `main` branch trigger Vercel production builds.

References: [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase TLS configuration](https://supabase.com/docs/guides/platform/ssl-enforcement), [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi).
