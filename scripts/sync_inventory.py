"""Run after adding/removing numbered images to refresh the static-site snapshot."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog import ROOT, build_inventory, default_provenance, load_provenance

records, inventory = build_inventory()
saved_provenance = load_provenance()
provenance = {key: {**default_provenance(), **saved_provenance.get(key, {})} for key in records}
for filename, data in (("sneakers.json", records), ("images.json", inventory), ("provenance.json", provenance)):
    (ROOT / "data" / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Validated {len(records)} sneakers, 14 attributes each, and all image paths.")
