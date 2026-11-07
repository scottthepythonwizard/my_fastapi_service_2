# Sole Compare

A standalone frontend for the existing SOLE Sneaker Archive. Choose exactly two distinct sneakers, then compare Brand, Name, Release Year, Category, Price, Colorway, Country of Origin, Materials, Closure type, Cut, Sole material, Cushioning, Weight, and Release month in aligned columns.

The application fetches the existing authenticated `GET /api/v1/catalog` endpoint. All inventory, prices, measurements, estimates and photos come from the Archive. There are no local sneaker records, generated mock data, or JSON fallbacks. Images resolve against the API origin. The existing FastAPI CORS configuration already allows the frontend's API-key header.

## Files and components

- `index.html`: accessible page, two selection slots, inventory filters, comparison region.
- `archive.css`: exact copy of the current Archive stylesheet, including paper/lime colors, Arial/Helvetica typography, cards, pills and responsive breakpoints.
- `style.css`: comparison-specific layout using those same design tokens.
- `config.js`: API origin and matching classroom API key.
- `core.js`: API adapter, response validation, 14-field definitions, selection rules, filtering, value formatting and difference detection.
- `components.js`: reusable `InventoryCard`, `SelectionSlot`, `ComparisonTable`, image and attribute components. API values render through `textContent`.
- `app.js`: inventory loading, selection state, accessible announcements, filter and comparison events, retry handling.
- `start.mjs`: starts the existing sibling Archive API, waits for its health check, verifies CORS, then starts Compare. Reuses an already-running Archive API.
- `server.mjs`: dependency-free local static server bound to `127.0.0.1`, serving only application assets from this `sole_compare_final` folder.
- `tests/`: selection/authentication tests and integration tests using the real FastAPI inventory.

## Start this final application (PowerShell)

Prerequisites: Node.js 20+ and your existing FastAPI Python environment. No npm packages need installing.

Keep `sole_compare_final` beside `my_fastapi_service_sole_list`, which is the existing Sole Archive backend and inventory. Start both applications with one command from this final folder:

```powershell
Set-Location 'C:\Users\user\Downloads\my-fastapi-service-scottthepythonwizard-patch-1\sole_compare_final'
npm start
```

Keep that terminal open. Open http://127.0.0.1:5173 for **SOLE. COMPARE** and http://127.0.0.1:8000/archive for Archive. Ctrl+C stops the servers started by this command; an Archive server that was already running is left running. After restarting your computer, run the same `npm start` command again. Starting only a static server or opening HTML does not start FastAPI.

If the Archive's Python environment has not been created, run this once before `npm start`:

```powershell
Set-Location 'C:\Users\user\Downloads\my-fastapi-service-scottthepythonwizard-patch-1\my_fastapi_service_sole_list'
py -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

To run the servers separately, start Archive in one terminal:

```powershell
Set-Location 'C:\Users\user\Downloads\my-fastapi-service-scottthepythonwizard-patch-1\my_fastapi_service_sole_list'
& .\.venv\Scripts\python.exe -m uvicorn api.index:app --host 127.0.0.1 --port 8000
```

Then run `npm run start:frontend` from `sole_compare_final` in a second terminal. If port 5173 is already serving Compare, use the running page rather than starting another copy. For a custom frontend port, set `PORT` and add its exact origin to the backend's `SOLE_CORS_ORIGINS` before starting the servers.

## Exact fetch URL and backend CORS

The frontend configuration in `config.js` is:

```javascript
window.SOLE_COMPARE_CONFIG = Object.freeze({
  apiOrigin: "http://127.0.0.1:8000",
  apiKey: "student-api-key-123",
  fitOrigin: "http://127.0.0.1:8002",
});
```

`core.js` uses the existing Archive route and API-key header:

```javascript
url = `${apiOrigin(config.apiOrigin)}/api/v1/catalog`;
response = await fetcher(url, {
  headers: { "x-api-key": config.apiKey },
  cache: "no-store",
  signal: AbortSignal.timeout(10000),
});
```

The existing backend in `../my_fastapi_service_sole_list/api/index.py` already has the matching CORS configuration. No replacement API or duplicate inventory is needed:

```python
CORS_ORIGINS = [origin.strip() for origin in os.environ.get(
    "SOLE_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5500,http://127.0.0.1:5500,"
    "http://localhost:8080,http://127.0.0.1:8080,"
    "http://localhost:8002,http://127.0.0.1:8002",
).split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False,
    allow_methods=["GET", "OPTIONS"], allow_headers=["x-api-key", "Content-Type"],
)
```

## Diagnose a connection failure

The recurring failure was caused by the Archive API not listening on port 8000. The configured fetch URL and allowed frontend origin already matched, but neither could work without the backend process. The old setup instructions also pointed to an older `sole_compare` folder. The updated `npm start` now starts the existing Archive API before serving this final frontend. SoleFit on port 8002 is a separate service and is not the Archive data source.

In a third PowerShell terminal:

```powershell
$api = 'http://127.0.0.1:8000'
Test-NetConnection 127.0.0.1 -Port 8000
Invoke-RestMethod "$api/health"
$headers = @{ 'x-api-key' = 'student-api-key-123' }
(Invoke-RestMethod "$api/api/v1/catalog" -Headers $headers).count

$preflight = Invoke-WebRequest "$api/api/v1/catalog" -Method Options -Headers @{
    Origin = 'http://127.0.0.1:5173'
    'Access-Control-Request-Method' = 'GET'
    'Access-Control-Request-Headers' = 'x-api-key'
}
$preflight.StatusCode
$preflight.Headers['Access-Control-Allow-Origin']
```

Expected: `TcpTestSucceeded: True`, health `status: ok`, inventory count `20`, preflight status `200`, and allowed origin `http://127.0.0.1:5173`. A refused connection means start the API. HTTP 401 means the key must match `SOLE_API_KEY`; HTTP 404 means check the host and `/api/v1/catalog` route.

FastAPI explicitly allows `http://localhost` and `http://127.0.0.1` on ports 3000, 5173, 5500, 8080, and 8002, with GET/OPTIONS and the `x-api-key` header. For another frontend origin, set the **backend** environment variable before starting/restarting uvicorn:

```powershell
# Comma-separated exact frontend origins, without a trailing slash; replaces the defaults.
$env:SOLE_CORS_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5174,https://your-compare-site.example'
```

Open browser Developer Tools (F12), choose Console and Network, then click **Try again**. `[Sole Compare] Archive request failed` logs the full endpoint, method, HTTP status (or `null` when no HTTP response arrived), response content type, and original error. It does not log the API key. Browsers hide the HTTP response for some CORS failures; use the Network tab and preflight check to distinguish those from a stopped server. HTTP 200 with HTML indicates a frontend/login URL instead of the JSON API. HTTPS pages need an accessible HTTPS API for hosted use.

## Connect to another API deployment

Edit `config.js`:

```javascript
window.SOLE_COMPARE_CONFIG = Object.freeze({
  apiOrigin: 'https://your-public-api.vercel.app',
  apiKey: 'student-api-key-123',
});
```

Use the origin without `/api/v1` or another path. `apiKey` must match the backend's `SOLE_API_KEY`. Reload the page after editing. No configuration is saved in browser storage. API-key failures, unavailable servers, empty inventories and incomplete data show a retry state. The application never substitutes invented data.

For a remote API, use `npm run start:frontend`; `npm start` is specifically the local two-server setup on ports 8000 and 5173.

Your previously supplied Vercel preview requires Vercel access; local API integration is the default. Use an accessible API deployment for hosted operation. HTTPS frontends require an HTTPS API to avoid mixed-content blocking. Frontend static files can be hosted separately; retain all seven frontend assets (HTML, two stylesheets, and four JavaScript modules/configuration files).

The classroom key is intentionally browser-visible. This frontend retains the Archive's demonstration authentication approach; use user authentication or server-side credential handling before protecting private production data.

## Use the application

1. Choose a sneaker in each selector or select two inventory cards. Duplicate pairs and a third selection are blocked.
2. Select **Compare pairs** to display all 14 attributes. Both shoes share the same table rows, including on small screens.
3. Use **Show differences only** to hide matching rows, or **Swap pairs** to reverse columns.
4. Remove a selected pair or change a selector to try another pairing. Search and brand filters preserve selection.

Weights remain per shoe with the existing estimate notes. Release month includes the reference-edition year when supplied by API provenance; Release Year retains the original archive value. Country of Origin keeps the supplied archive value and is not relabeled as a manufacturing location. Alternate-photo notes remain visible.

## Verification

From the application directory:

```powershell
npm test
# With npm start running both servers in another terminal:
npm run test:live
```

The live suite also checks that attempting a second local startup reports the occupied port without stopping the existing Archive or Compare server. For a different backend, set `SOLE_API_ORIGIN` and `SOLE_API_KEY` and run `node --test tests/live.test.js` alone. These test environment variables do not replace browser settings in `config.js`.

The connection-fix unit tests cover 401/403/404/503, failed network requests, timeout, non-JSON responses, invalid inventory, and diagnostics without API-key logging. Backend tests cover preflight plus authenticated and unauthorized responses from all ten allowed local origins, and rejection of an unrelated origin. Live tests use the real Archive inventory and images.

This update passed six frontend unit tests, six live integration/startup tests, and twelve existing Archive backend tests. Browser verification confirmed the exact SOLE. COMPARE header, 20 real shoes, two selected pairs, all 14 comparison rows, loaded product images, a working return link to Archive, and no console errors. Stopping the launcher released both local ports; running npm start again restored the inventory in the browser. The existing Find my size in SoleFit link still passes the selected reference and target IDs to the separate sizing app on port 8002.
