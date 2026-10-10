"""One-time migration of the supplied reference into the 14-field catalog."""
import ast
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
source = ast.parse(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
reference = ast.literal_eval(source.body[0].value)
records = {}
images = {}
catalog_path = root / "data/sneakers.json"
existing_records = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.exists() else {}
for shoe in reference:
    key = str(shoe["id"])
    records[key] = {
        "brand": shoe["brand"],
        "name": shoe["model"],
        "year": shoe["year"],
        "descriptive_overview": shoe["description"],
        "gender_target": "Both",
        "retail_price": shoe["price"],
        # Preserve colors reviewed against the local photograph when reimporting.
        "colorway": existing_records.get(key, {}).get("colorway", shoe["colorway"]),
        "description": f'{shoe["description"]} Listed in the {shoe["category"].lower()} collection. Further product background has not been supplied.',
        "category": shoe["category"],
        "details_specifications": f'Upper and sole composition: {"; ".join(shoe["materials"])}. Exact weight, fit, and construction specifications are not documented.',
        "shoe_reference_number": f'SOLE-{shoe["id"]:06d}',
        "review_stars": 4.5,
        "materials": "; ".join(shoe["materials"]),
        "country_of_origin": shoe.get("country_of_origin") or "Country not supplied",
    }
    images[key] = {
        "image": f"images/{key}.jpg",
        "note": "",
    }
(root / "data").mkdir(exist_ok=True)
(root / "data/sneakers.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(root / "data/images.json").write_text(json.dumps({"hero": "images/hero.jpg", "items": images}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
# Importing a new reference resets evidence; generic SKUs/ratings are demonstration data.
from sys import path
path.insert(0, str(root))
from catalog import default_provenance
provenance = {key: default_provenance() for key in records}
for key, record in records.items():
    if record["country_of_origin"] != "Country not supplied":
        provenance[key]["country_of_origin"] = {"status": "provided", "sources": [], "note": "Country of Origin from the supplied reference; not a verified manufacturing location."}
(root / "data/provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
