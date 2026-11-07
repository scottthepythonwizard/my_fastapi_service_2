import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from pydantic import ValidationError
import catalog
from api.index import API_KEY, API_VERSION, app
from index22 import app as compatibility_app


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture = patch.object(app.state, "database")
        database = fixture.start()
        database.list.side_effect = catalog.catalog_items
        database.count.side_effect = lambda: len(catalog.catalog_items())
        database.get.side_effect = lambda identity: next(
            (item for item in catalog.catalog_items() if item["id"] == identity), None
        )
        cls.addClassCleanup(fixture.stop)
        cls.client = TestClient(app, headers={"x-api-key": API_KEY})
        cls.client.__enter__()
        cls.addClassCleanup(cls.client.__exit__, None, None, None)

    def test_exact_attributes_and_all_images_accounted_for(self):
        records, inventory = catalog.build_inventory()
        saved = json.loads((catalog.ROOT / "data/images.json").read_text(encoding="utf-8"))
        self.assertEqual(inventory, saved, "Run scripts/sync_inventory.py")
        self.assertEqual(len(records), 20)
        self.assertEqual(set(records), set(inventory["items"]))
        for record in records.values():
            self.assertEqual(set(record), set(catalog.SneakerAttributes.model_fields))
            self.assertEqual(len(record), 20)
            self.assertTrue(all(value is not None and value != "" for key, value in record.items()
                                if key not in {"weight_g", "release_month"}))
        for media in inventory["items"].values():
            self.assertTrue((catalog.ROOT / media["image"]).is_file())

    def test_every_archived_pair_has_complete_specifications_and_evidence(self):
        records = catalog.load_records()
        provenance = catalog.load_provenance()
        fields = ("closure_type", "cut", "sole_material", "cushioning", "weight_g", "release_month")
        for key, shoe in records.items():
            with self.subTest(sneaker=key):
                for field in fields:
                    self.assertNotIn(shoe[field], (None, "", "Not documented"))
                    evidence = provenance[key][field]
                    self.assertIn(evidence["status"], {"verified", "observed", "estimated"})
                    self.assertTrue(evidence["note"])
                    if evidence["status"] == "verified":
                        self.assertTrue(evidence["sources"])
                self.assertGreaterEqual(shoe["weight_g"], 150)
                self.assertLessEqual(shoe["weight_g"], 600)
                self.assertIn(shoe["release_month"], range(1, 13))
                self.assertTrue(provenance[key]["shoe_reference_number"]["sources"])
        self.assertEqual(records["18"]["closure_type"], "Laceless")
        self.assertEqual(records["18"]["cut"], "High")
        self.assertEqual(provenance["6"]["weight_g"]["status"], "verified")
        self.assertEqual(provenance["5"]["release_month"]["status"], "estimated")

    def test_schema_rejects_extra_fields_and_invalid_ratings(self):
        self.assertEqual(len(catalog.SneakerAttributes().model_dump()), 20)
        for value in ({"id": 1}, {"review_stars": 5.1}, {"review_stars": "Not yet rated"}, {"review_stars": float("nan")},
                      {"gender_target": "Unknown"}, {"gender_target": "Not specified"}, {"gender_target": ""},
                      {"category": "Indoor Basketball"}, {"category": ""}, {"brand": " "},
                      {"year": "1985"}, {"review_stars": "4.5"}, {"weight_g": -1},
                      {"weight_g": float("inf")}, {"release_month": 13}, {"release_month": "1"},
                      {"closure_type": "Zipper"}, {"cut": "Tall"}):
            with self.assertRaises(ValidationError):
                catalog.SneakerAttributes(**value)

    def test_retail_only_category_gender_and_research_provenance(self):
        records = catalog.load_records()
        provenance = catalog.load_provenance()
        self.assertEqual(set(records), set(provenance))
        for key, shoe in records.items():
            self.assertEqual(len(shoe), 20)
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
                self.assertEqual(len(records["21"]), 20)
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
            self.assertEqual(self.client.get(f'/api/v1/sneakers/{shoe["id"]}').json(), shoe)
        self.assertEqual(self.client.get("/sneakers/9999").status_code, 404)
        self.assertEqual(self.client.get("/sneakers/invalid").status_code, 422)

    def test_search_route_and_query_validation(self):
        for query in ("Nike", " CHUCK ", "1985", "White Cement", "350", "no-such-shoe",
                      "United States", "Foam", "Basketball", "Lace-up", "nitrogen"):
            response = self.client.get("/api/v1/sneakers/search", params={"q": query})
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["count"], len(data["results"]))
            self.assertEqual(data["query"], query.strip().lower())
            for shoe in data["results"]:
                self.assertIn(data["query"], " ".join(str(shoe[field]) for field in catalog.SneakerAttributes.model_fields
                                                     if shoe[field] is not None).lower())
            if query in {"United States", "Foam", "Basketball", "Lace-up", "nitrogen"}:
                self.assertGreater(data["count"], 0)
        # Construction metadata also matches: the Jordan 4 uses Nike Air cushioning.
        nike_results = self.client.get("/sneakers/search", params={"q": "Nike"}).json()["results"]
        self.assertEqual({shoe["id"] for shoe in nike_results}, {1, 3, 7, 10, 15})
        for params in ({}, {"q": ""}, {"q": "  "}):
            self.assertEqual(self.client.get("/sneakers/search", params=params).status_code, 422)

    def test_canonical_api_and_frontend_assets(self):
        response = self.client.get("/api/v1/catalog")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 20)
        for item in data["items"]:
            self.assertEqual(len(item["attributes"]), 20)
            self.assertEqual(self.client.get(f'/api/v1/catalog/{item["id"]}').json(), item)
            self.assertEqual(self.client.get("/" + item["image_url"]).status_code, 200)
        for path in ("/archive", "/index.html", "/style.css", "/app.js", "/fit-community.js", "/data/sneakers.json", "/data/images.json", "/data/provenance.json"):
            self.assertEqual(self.client.get(path).status_code, 200)

    def test_authentication_protects_versioned_legacy_and_snapshot_routes(self):
        paths = ("/api/v1/sneakers", "/api/v1/sneakers/1", "/api/v1/sneakers/search?q=Nike",
                 "/api/v1/catalog", "/api/v1/catalog/1", "/sneakers", "/sneakers/1",
                 "/sneakers/search?q=Nike", "/catalog", "/catalog/1",
                 "/data/sneakers.json", "/data/images.json", "/data/provenance.json")
        with TestClient(app) as anonymous:
            for path in paths:
                for headers in ({}, {"x-api-key": "wrong-key"}, {"x-api-key": ""}):
                    with self.subTest(path=path, headers=headers):
                        response = anonymous.get(path, headers=headers)
                        self.assertEqual(response.status_code, 401)
                        self.assertEqual(response.json()["detail"], "Invalid or missing API key.")
                self.assertEqual(anonymous.get(path, headers={"x-api-key": API_KEY}).status_code, 200)
            for path in ("/", "/health", "/docs", "/openapi.json", "/archive", "/images/1.jpg"):
                self.assertEqual(anonymous.get(path).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/catalog/9999").status_code, 404)
        self.assertEqual(self.client.get("/data/not-a-file.json").status_code, 404)

    def test_health_and_swagger_security(self):
        health = self.client.get("/health").json()
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["service"], "Simple Sneaker API")
        self.assertEqual(health["version"], API_VERSION)
        self.assertLess(abs((datetime.now(timezone.utc) - datetime.fromisoformat(health["timestamp"])).total_seconds()), 5)
        schema = self.client.get("/openapi.json").json()
        self.assertEqual(schema["info"]["version"], API_VERSION)
        key = schema["components"]["securitySchemes"]["APIKeyHeader"]
        self.assertEqual(key, {"type": "apiKey", "in": "header", "name": "x-api-key"})
        self.assertNotIn("security", schema["paths"]["/health"]["get"])
        for path, operations in schema["paths"].items():
            if path.startswith("/api/v1/"):
                self.assertEqual(operations["get"]["security"], [{"APIKeyHeader": []}])

    def test_cors_allows_authenticated_cross_origin_requests(self):
        for host in ("localhost", "127.0.0.1"):
            for port in (3000, 5173, 5500, 8080, 8002):
                origin = f"http://{host}:{port}"
                with self.subTest(origin=origin):
                    response = self.client.options("/api/v1/catalog", headers={
                        "Origin": origin, "Access-Control-Request-Method": "GET",
                        "Access-Control-Request-Headers": "x-api-key",
                    })
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.headers["access-control-allow-origin"], origin)
                    self.assertIn("x-api-key", response.headers["access-control-allow-headers"])
                    for key, status in ((API_KEY, 200), ("incorrect", 401)):
                        response = self.client.get("/api/v1/catalog", headers={"Origin": origin, "x-api-key": key})
                        self.assertEqual(response.status_code, status)
                        self.assertEqual(response.headers["access-control-allow-origin"], origin)
        rejected = self.client.options("/api/v1/catalog", headers={
            "Origin": "https://unrelated.example", "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-api-key",
        })
        self.assertEqual(rejected.status_code, 400)
        self.assertNotIn("access-control-allow-origin", rejected.headers)

    def test_seed_loader_rejects_incomplete_or_invalid_saved_data(self):
        for change in ("missing", "invalid"):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                (root / "data").mkdir()
                record = catalog.SneakerAttributes().model_dump()
                if change == "missing":
                    del record["weight_g"]
                else:
                    record["weight_g"] = -10
                (root / "data/sneakers.json").write_text(json.dumps({"1": record}), encoding="utf-8")
                with patch.object(catalog, "ROOT", root):
                    with self.assertRaises((ValueError, ValidationError)):
                        catalog.load_records()


if __name__ == "__main__":
    unittest.main()
