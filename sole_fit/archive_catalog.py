"""Sole Fit's client for the shared Archive catalog API."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class CatalogUnavailable(RuntimeError):
    pass


def archive_origin():
    return os.environ.get('SOLE_ARCHIVE_ORIGIN', 'http://127.0.0.1:8000').rstrip('/')


class ArchiveCatalog:
    def _get(self, path, *, missing_ok=False):
        key = os.environ.get('SOLE_API_KEY', 'student-api-key-123')
        request = Request(f'{archive_origin()}/api/v1{path}', headers={'x-api-key': key})
        try:
            with urlopen(request, timeout=8) as response:
                return json.load(response)
        except HTTPError as error:
            if missing_ok and error.code == 404:
                return None
            raise CatalogUnavailable from None
        except (URLError, OSError, ValueError):
            raise CatalogUnavailable from None

    def catalog(self):
        return self._get('/catalog')['items']

    def sneaker(self, identity):
        return self._get(f'/catalog/{identity}', missing_ok=True)


def preview_stats(identity):
    fit = dict.fromkeys(('runs_small', 'true_to_size', 'runs_large'), 0)
    width = dict.fromkeys(('narrow', 'standard', 'wide'), 0)
    return {
        'sneaker_id': identity, 'total_votes': 0, 'tts_percentage': 0,
        'length_distribution': {'counts': fit, 'percentages': fit.copy()},
        'width_distribution': {'counts': width, 'percentages': width.copy()},
        'preview': True,
    }
