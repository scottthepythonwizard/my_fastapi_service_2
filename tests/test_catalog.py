import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from pydantic import ValidationError
import catalog
from api.index import app
from index22 import app as compatibility_app


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_exact_attributes_and_all_images_accounted_for(self):
        records, inventory = catalog.build_inventory()
        saved = json.loads((catalog.ROOT / "data/images.json").read_text(encoding="utf-8"))
        self.assertEqual(inventory, saved, "Run scripts/sync_inventory.py")
        self.assertEqual(len(records), 20)
        self.assertEqual(set(records), set(inventory["items"]))
        for record in records.values():
            self.assertEqual(set(record), set(catalog.SneakerAttributes.model_fields))
            self.assertEqual(len(record), 14)
            self.assertTrue(all(value is not None and value != "" for value in record.values()))
        for media in inventory["items"].values():
            self.assertTrue((catalog.ROOT / media["image"]).is_file())

    def test_schema_rejects_extra_fields_and_invalid_ratings(self):
        self.assertEqual(len(catalog.SneakerAttributes().model_dump()), 14)
        for value in ({"id": 1}, {"review_stars": 5.1}, {"review_stars": "Not yet rated"}, {"review_stars": float("nan")},
                      {"gender_target": "Unknown"}, {"gender_target": "Not specified"}, {"gender_target": ""},
                      {"category": "Indoor Basketball"}, {"category": ""}, {"brand": " "}):
            with self.assertRaises(ValidationError):
                catalog.SneakerAttributes(**value)

    def test_retail_only_category_gender_and_research_provenance(self):
        records = catalog.load_records()
        provenance = catalog.load_provenance()
        self.assertEqual(set(records), set(provenance))
        for key, shoe in records.items():
            self.assertEqual(len(shoe), 14)
            self.assertIn(shoe["gender_target"], {"Men", "Women", "Both"})
            self.assertIn(shoe["category"], {"Basketball", "Running", "Lifestyle", "Football"})
            self.assertNotIn(" ", shoe["category"])
            self.assertTrue(shoe["country_of_origin"].strip())
            self.assertTrue(shoe["retail_price"].startswith("₱"))
            self.assertFalse(any("resell" in field or "resale" in field for field in shoe))
            self.assertNotIn("historical_significance_era", shoe)
            self.assertNotIn("price", shoe)
            for category in {"Basketball", "Running", "Lifestyle", "Football"}:
                self.assertNotIn(category.lower(), shoe["details_specifications"].lower())
            for field in ("shoe_reference_number", "review_stars", "country_of_origin"):
                evidence = provenance[key][field]
                if evidence["status"] == "verified":
                    self.assertTrue(evidence["sources"])
                    self.assertTrue(all(url.startswith("https://") for url in evidence["sources"]))
                else:
                    self.assertIn(evidence["status"], {"mock", "unverified", "provided"})
                    self.assertTrue(evidence["note"])

    def test_inventory_discovers_new_images_and_reports_missing_ones(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "images").mkdir()
            (root / "data").mkdir()
            (root / "images/hero.jpg").touch()
            (root / "images/21.jpg").touch()
            (root / "data/images.json").write_text('{"items": {}}', encoding="utf-8")
            with patch.object(catalog, "ROOT", root):
                records, media = catalog.build_inventory({})
                self.assertEqual(len(records["21"]), 14)
                self.assertEqual(media["items"]["21"]["image"], "images/21.jpg")
                with self.assertRaisesRegex(ValueError, "Missing product images"):
                    catalog.build_inventory({"22": catalog.SneakerAttributes().model_dump()})

    def test_existing_home_list_and_detail_contracts(self):
        self.assertIs(app, compatibility_app)
        self.assertEqual(self.client.get("/").json()["message"], "Welcome to the Simple Sneaker API!")
        result = self.client.get("/sneakers").json()
        self.assertEqual(result["count"], 20)
        for shoe in result["sneakers"]:
            self.assertTrue({"id", "brand", "model", "year", "colorway", "price", "description"} <= set(shoe))
            self.assertEqual(shoe["name"], shoe["model"])
            self.assertEqual(shoe["price"], shoe["retail_price"])
            self.assertEqual(self.client.get(f'/sneakers/{shoe["id"]}').json(), shoe)
        self.assertEqual(self.client.get("/sneakers/9999").status_code, 404)
        self.assertEqual(self.client.get("/sneakers/invalid").status_code, 422)

    def test_search_route_and_query_validation(self):
        for query in ("Nike", " CHUCK ", "1985", "White Cement", "350", "no-such-shoe"):
            response = self.client.get("/sneakers/search", params={"q": query})
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["count"], len(data["results"]))
            self.assertEqual(data["query"], query.strip().lower())
            for shoe in data["results"]:
                self.assertIn(data["query"], f'{shoe["brand"]} {shoe["model"]} {shoe["year"]} {shoe["colorway"]}'.lower())
        self.assertEqual(self.client.get("/sneakers/search", params={"q": "Nike"}).json()["count"], 4)
        for params in ({}, {"q": ""}, {"q": "  "}):
            self.assertEqual(self.client.get("/sneakers/search", params=params).status_code, 422)

    def test_canonical_api_and_frontend_assets(self):
        response = self.client.get("/catalog")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 20)
        for item in data["items"]:
            self.assertEqual(len(item["attributes"]), 14)
            self.assertEqual(self.client.get("/" + item["image_url"]).status_code, 200)
        for path in ("/archive", "/index.html", "/style.css", "/app.js", "/data/sneakers.json", "/data/images.json", "/data/provenance.json"):
            self.assertEqual(self.client.get(path).status_code, 200)


if __name__ == "__main__":
    unittest.main()
