"""Account assets must not expose privileged credentials."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.index import app

class AccountRoutesTests(unittest.TestCase):
    def test_public_configuration_has_no_privileged_secrets(self):
        with patch.dict(os.environ, {'SOLE_ADMIN_TOKEN':'private-test-admin-token', 'SOLE_DATABASE_URL':'private-test-database-url'}):
            with TestClient(app) as client:
                for route in ('/account','/account.js','/account.css','/account-config.js'):
                    response=client.get(route)
                    self.assertEqual(response.status_code,200)
                    self.assertNotIn('private-test-admin-token',response.text)
                    self.assertNotIn('private-test-database-url',response.text)
                self.assertIn('sb_publishable_',client.get('/account-config.js').text)
                self.assertIn('My favorites',client.get('/account').text)
