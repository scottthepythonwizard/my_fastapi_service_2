import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from archive_catalog import preview_stats
from fit_engine import fit_profile, normalize_size, recommend
from api.index import ROOT, create_app


class FixtureCatalog:
    def catalog(self):
        return json.loads((ROOT / 'data/catalog.json').read_text(encoding='utf-8'))['items']

    def sneaker(self, identity):
        return next((item for item in self.catalog() if item['id'] == identity), None)


class SoleFitTests(unittest.TestCase):
    def setUp(self):
        self.catalog = FixtureCatalog()
        self.client = TestClient(create_app(self.catalog))
        self.addCleanup(self.client.close)

    def test_real_catalog_images_and_unseeded_stats(self):
        payload = self.client.get('/api/catalog').json()
        self.assertEqual(payload['count'], 20)
        for item in payload['items']:
            self.assertEqual(self.client.get('/' + item['image_url']).status_code, 200)
            stats = self.client.get(f"/api/sneakers/{item['id']}/fit-stats").json()
            self.assertEqual(stats['total_votes'], 0)
            self.assertEqual(stats['tts_percentage'], 0)
            self.assertEqual(sum(stats['length_distribution']['counts'].values()), 0)
            self.assertIn('no community votes', stats['profile']['basis'])
        for url in ('/', '/index.html', '/docs', '/app.js', '/components.js', '/community.js', '/config.js', '/style.css', '/health'):
            self.assertEqual(self.client.get(url).status_code, 200)
        for url in ('/database.py', '/fit_engine.py', '/data/solefit.sqlite3', '/api/index_v1_backup.py'):
            self.assertEqual(self.client.get(url).status_code, 404)

    def test_voting_remains_disabled_and_unknown_sneakers_return_404(self):
        response = self.client.post('/api/fit/feedback', json={
            'sneaker_id': 1, 'fit_rating': 'true_to_size', 'width_rating': 'standard'})
        self.assertEqual(response.status_code, 503)
        for route in ('/api/sneakers/9999', '/api/sneakers/9999/fit-stats'):
            self.assertEqual(self.client.get(route).status_code, 404)
        self.assertEqual(self.client.get('/api/sneakers/1/fit-stats').json()['total_votes'], 0)

    def test_identity_sizes_and_conversion_validation(self):
        for system, size in (('us_men', 9), ('us_women', 10.5), ('eu', 42.5)):
            response = self.client.get('/api/fit/recommend', params={
                'reference_shoe_id': 1, 'target_shoe_id': 1, 'reference_size': size, 'size_system': system})
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertEqual(result['recommended_size'], size)
            self.assertEqual(result['recommended_us_men'], 9)
            self.assertEqual(result['offset_us'], 0)
            self.assertEqual(result['confidence'], 'high')
        for size, system in ((9.25, 'us_men'), (3.5, 'us_men'), (37, 'eu'), (18, 'us_women')):
            with self.assertRaises(ValueError):
                normalize_size(size, system)

    def test_api_rejects_invalid_recommendation_inputs(self):
        params = {'reference_shoe_id': 1, 'target_shoe_id': 2, 'reference_size': 9}
        for changes, status in (({'reference_size': 'nan'}, 422), ({'reference_size': 'inf'}, 422),
                                ({'reference_size': 9.25}, 422), ({'target_shoe_id': 0}, 422),
                                ({'target_shoe_id': 9999}, 404), ({'size_system': 'uk'}, 422),
                                ({'foot_width': 'huge'}, 422)):
            response = self.client.get('/api/fit/recommend', params={**params, **changes})
            self.assertEqual(response.status_code, status, changes)
        self.assertEqual(self.client.get('/api/fit/recommend').status_code, 422)

    def test_structural_relative_offsets_width_and_size_boundaries(self):
        items = self.catalog.catalog()
        converse = next(item for item in items if item['attributes']['brand'] == 'Converse')
        football = next(item for item in items if item['attributes']['category'] == 'Football')
        left, right = preview_stats(converse['id']), preview_stats(football['id'])
        forward = recommend(converse, football, 9, 'us_men', 'wide', left, right)
        reverse = recommend(football, converse, 9, 'us_men', 'standard', right, left)
        self.assertGreaterEqual(forward['offset_us'], .5)
        self.assertLessEqual(reverse['offset_us'], -.5)
        self.assertEqual(forward['confidence'], 'low')
        self.assertIn('starting point', forward['reason'])
        self.assertEqual(forward['recommended_us_men'] * 2 % 1, 0)
        self.assertEqual(forward['target_profile']['width_profile'], 'Narrow')
        with self.assertRaisesRegex(ValueError, 'outside'):
            recommend(converse, football, 16, 'us_men', 'wide', left, right)
        # Every real catalog pairing must produce a bounded, half-step recommendation.
        for a in items:
            for b in items:
                result = recommend(a, b, 9, 'us_men', 'standard', preview_stats(a['id']), preview_stats(b['id']))
                self.assertLessEqual(abs(result['offset_us']), 1)
                self.assertEqual(result['recommended_us_men'] * 2 % 1, 0)

    def test_file_frontend_can_read_shared_catalog(self):
        for route in ('/api/catalog', '/api/fit/sizes', '/api/sneakers/1/fit-stats',
                      '/api/fit/recommend?reference_shoe_id=1&target_shoe_id=2&reference_size=9'):
            response = self.client.get(route, headers={'Origin': 'null'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['access-control-allow-origin'], 'null')


if __name__ == '__main__':
    unittest.main()
