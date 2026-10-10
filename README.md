# SOLE. Sneaker archive

A dependency-free HTML/CSS/JavaScript frontend with a shared FastAPI backend. The design follows the supplied SOLE screenshot: warm paper background, lime editorial hero, archive photography, pill controls, and responsive product cards.

## Run locally

From this directory, with Python 3.10 or newer:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.index:app --reload
```

Open http://127.0.0.1:8000/archive. `/` still returns the original API welcome response. The original `uvicorn index22:app` entry point also works.

For a static-only preview, run `python -m http.server 8080` and open http://127.0.0.1:8080/index.html. The frontend falls back to the bundled JSON when `/catalog` is unavailable. Serve files over HTTP; opening `index.html` with `file://` prevents JSON fetching in browsers.

The frontend requests the same-origin `/catalog` endpoint. When the API is hosted separately, define `window.SOLE_API_URL` before loading `app.js`. Product images and the fallback data remain local to the frontend.

## Files

- `index.html`: page structure, search controls, and native detail dialog.
- `style.css`: responsive visual design, hover states, focus indicators, and reduced-motion support.
- `app.js`: inventory loading, safe DOM rendering, search, brand filtering, sorting, and modal controls.
- `data/sneakers.json`: the canonical records, keyed by stable numeric ID.
- `data/images.json`: image manifest and optional photo notes, separate from product attributes.
- `data/provenance.json`: source links, reference-edition notes, and explicit mock/unverified flags.
- `catalog.py`: strict Pydantic schema, image discovery, placeholder defaults, and compatibility serializer.
- `api/index.py`: existing API routes, canonical catalog, and local static assets.
- `index22.py`: imports the same app so the two entry points cannot drift.
- `screenshots/`: verified desktop, mobile, and detail previews.

## Exactly 14 attributes

Each value in `data/sneakers.json`, and each `/catalog` item's `attributes` object, contains exactly these keys:

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
```

IDs, photo URLs, photo notes, and research provenance are transport metadata outside `attributes`. The Pydantic schema rejects extra attributes. Ratings are finite numbers from 0 to 5; gender accepts only Men, Women, or Both. Category accepts only Basketball, Running, Lifestyle, or Football. Unknown years use `"Not documented"`. New records default to Both and Lifestyle, with explicitly marked demonstration SKU/rating values.

All 20 records retain the user's supplied PHP retail references, archive years, names, and materials. Colorways describe the colors visually observed in each local product photo. Category is a separate one-word field. Details/specifications contain materials, construction, and technical features without category labels. Only retail price is stored and displayed.

The UI uses `Archive` for the header/editorial archive title and `SOLE / A CLOSER LOOK` for the modal image footer. Modal body text is 16px, specification values are 15px, and labels are 14px. The concise `descriptive_overview` appears immediately beneath the retail price. In the specification sheet, `Country of Origin` replaces the former `Description` row and displays `country_of_origin` verbatim from the supplied reference. The longer `description` remains in the data/API for compatibility and is hidden from that row.

Research snapshot: 2026-10-09. Fifteen SKU references and five rating aggregates have supporting source links in `data/provenance.json`. Five SKUs and fifteen ratings are realistic demonstration values, visibly marked `Mock SKU` or `Mock rating` in the modal. Ratings from retailers/manufacturers can aggregate sizes and colorways; provenance notes describe their scope. All 20 `country_of_origin` values come from the latest user-supplied code reference, with provenance marked `provided`. These values are displayed as Country of Origin, without interpreting them as manufacturing locations or prefixing them with "Made in".

Reference SKUs sometimes identify a specific modern retro edition, while the supplied archive year identifies the original silhouette. Those differences are disclosed alongside the SKU. Research concerns the supplied catalog colorway, not authentication of the pictured physical pair. PHP retail prices remain user-supplied references, not live prices.

All 20 local photos were visually reviewed for colorway accuracy. The grid, modal, image alt text, and API use these reviewed color descriptions. Photo notes are empty, and reimporting the supplied reference preserves existing reviewed colorways. Original assets are used at their available resolution; no missing product image is substituted with an unrelated sneaker.

## API compatibility

- `GET /`: original welcome response.
- `GET /sneakers`: retains `{count, sneakers}` and each item's original `id`, `brand`, `model`, `year`, `colorway`, `price`, and `description` fields, alongside expanded attributes.
- `GET /sneakers/search?q=...`: retains `{query, count, results}`; searches brand, model/name, year, and colorway. Registered before the ID route so `search` no longer produces an integer-validation error.
- `GET /sneakers/{sneaker_id}`: retains the original detail shape and 404 for missing IDs.
- `GET /catalog`: returns `{count, items}`, with each item shaped as `{id, image_url, image_note, attributes, provenance}`. Only `attributes` is the canonical 14-field product object.

Legacy responses retain `id`, `model`, and `price` outside the canonical 14-field schema to avoid breaking existing clients. The `price` alias equals `retail_price`. No API route is removed or renamed.

## Update the inventory

Product photos use stable positive numeric filenames, such as `images/21.jpg`. Supported formats: JPG, JPEG, PNG, WebP, AVIF. The editorial photo is named `hero` with a supported extension.

Add a photo and its optional record to `data/sneakers.json`, then run:

```powershell
.\.venv\Scripts\python.exe scripts\sync_inventory.py
```

The backend discovers images directly on requests. New photos without metadata receive all 14 defaults. The sync script writes the same inventory and provenance for static hosting. Missing images, duplicate IDs, and unsupported product naming fail with an explicit error. To remove a pair, remove both its record and its photo before syncing. Add source evidence to `data/provenance.json` when replacing demonstration values with researched data. Reimporting a reference via `scripts/import_reference.py` resets the SKU/rating evidence to mock defaults, preventing stale verification claims.

## Validation

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
node --check app.js
```

Seven regression tests cover the schema, complete image manifest, new-image discovery, missing-photo detection, strict gender/category, retail-only records, research provenance, both entry points, legacy routes, search validation, and static assets.

With the preview server running and Playwright installed (`npm install --no-save playwright`), run `node tests/browser.cjs`. Chrome must be installed; set `SOLE_BROWSER=msedge` to use Edge. Browser checks cover all 20 images and modals, hover, search, combined filters, numeric PHP sorting, release-year sorting, empty results, Escape, focus trapping/restoration, API fallback, complete-load failure/retry, and mobile overflow. Screenshots are written to `screenshots/`.
