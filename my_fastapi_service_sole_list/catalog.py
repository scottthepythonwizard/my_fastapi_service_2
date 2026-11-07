"""Canonical sneaker attributes and image inventory, shared by both API entry points."""
import json
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parent
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
UNKNOWN = "Not documented"
NonEmptyText = Annotated[str, Field(min_length=1)]


class SneakerAttributes(BaseModel):
    """Twenty typed attributes; measurement estimates are explained in provenance."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, strict=True)

    brand: NonEmptyText = "Brand not supplied"
    name: NonEmptyText = "Unnamed archive pair"
    year: Annotated[int, Field(ge=1800, le=2200)] | Literal["Not documented"] = UNKNOWN
    descriptive_overview: NonEmptyText = "Overview not supplied"
    gender_target: Literal["Men", "Women", "Both"] = "Both"
    retail_price: NonEmptyText = "Retail price not supplied"
    colorway: NonEmptyText = "Colorway not supplied"
    description: NonEmptyText = "Product details and background not supplied"
    category: Literal["Basketball", "Running", "Lifestyle", "Football"] = "Lifestyle"
    details_specifications: NonEmptyText = "Specifications not supplied"
    shoe_reference_number: NonEmptyText = "SOLE-000000"
    review_stars: Annotated[float, Field(ge=0, le=5, allow_inf_nan=False)] = 4.5
    materials: NonEmptyText = "Upper and sole materials not supplied"
    country_of_origin: NonEmptyText = "Country not supplied"
    closure_type: Literal["Lace-up", "Laceless", "Slip-on", "Hook-and-loop", "Not documented"] = UNKNOWN
    cut: Literal["Low", "Mid", "High", "Not documented"] = UNKNOWN
    sole_material: NonEmptyText = UNKNOWN
    cushioning: NonEmptyText = UNKNOWN
    weight_g: Annotated[float, Field(gt=0, allow_inf_nan=False)] | None = None
    release_month: Annotated[int, Field(ge=1, le=12)] | None = None


def load_records():
    """Require complete saved records and reject invalid types or attributes."""
    raw = json.loads((ROOT / "data/sneakers.json").read_text(encoding="utf-8"))
    for key, value in raw.items():
        if not key.isdecimal() or int(key) < 1 or str(int(key)) != key:
            raise ValueError(f"Invalid sneaker ID: {key}")
        missing = set(SneakerAttributes.model_fields) - set(value)
        if missing:
            raise ValueError(f"Sneaker {key} is missing required fields: {', '.join(sorted(missing))}")
    return {key: SneakerAttributes.model_validate(value).model_dump() for key, value in raw.items()}


def build_inventory(records=None):
    """Discover every numbered product photo; hero is a separate editorial asset."""
    records = load_records() if records is None else records
    saved = json.loads((ROOT / "data/images.json").read_text(encoding="utf-8"))
    items = {}
    hero = None
    for photo in sorted((ROOT / "images").iterdir()):
        if not photo.is_file() or photo.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if photo.stem == "hero":
            if hero:
                raise ValueError("Multiple hero images found")
            hero = f"images/{photo.name}"
            continue
        if not photo.stem.isdecimal() or int(photo.stem) < 1:
            raise ValueError(f"Product images must use positive numeric IDs: {photo.name}")
        key = str(int(photo.stem))
        if key in items:
            raise ValueError(f"Multiple product photos use ID {key}")
        items[key] = {"image": f"images/{photo.name}", "note": saved.get("items", {}).get(key, {}).get("note", "")}
        if key not in records:
            records[key] = SneakerAttributes(name=f"Archive pair {key}").model_dump()
    missing = set(records) - set(items)
    if missing:
        raise ValueError(f"Missing product images for IDs: {', '.join(sorted(missing))}")
    if not hero:
        raise ValueError("Missing images/hero image")
    return records, {"hero": hero, "items": dict(sorted(items.items(), key=lambda pair: int(pair[0])))}


def default_provenance():
    """Unknown/new records must never present demonstration values as real data."""
    return {
        "shoe_reference_number": {"status": "mock", "sources": [], "note": "Demonstration SKU; not a manufacturer-issued reference."},
        "review_stars": {"status": "mock", "sources": [], "note": "Demonstration rating; not a customer-review aggregate."},
        "country_of_origin": {"status": "unverified", "sources": [], "note": "Country of Origin has not been supplied."},
    }


def load_provenance():
    path = ROOT / "data/provenance.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def catalog_items():
    records, inventory = build_inventory()
    provenance = load_provenance()
    return [
        {"id": int(key), "image_url": media["image"], "image_note": media["note"],
         "attributes": records[key], "provenance": {**default_provenance(), **provenance.get(key, {})}}
        for key, media in inventory["items"].items()
    ]


def legacy_sneaker(item):
    """Preserve existing top-level fields without inflating canonical attributes."""
    attributes = item["attributes"]
    return {"id": item["id"], "model": attributes["name"], "price": attributes["retail_price"], **attributes}
