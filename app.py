"""Vercel entry point for Sole's API and its three websites."""
from pathlib import Path
import sys

ARCHIVE = Path(__file__).resolve().parent / "my_fastapi_service_sole_list"
sys.path.insert(0, str(ARCHIVE))

from my_fastapi_service_sole_list.api.index import app

__all__ = ["app"]
