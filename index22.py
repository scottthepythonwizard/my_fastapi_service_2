"""Compatibility entry point: uvicorn index22:app uses the same catalog and routes."""
from api.index import app, get_sneaker, get_sneakers, home, search_sneakers

__all__ = ["app", "get_sneaker", "get_sneakers", "home", "search_sneakers"]
