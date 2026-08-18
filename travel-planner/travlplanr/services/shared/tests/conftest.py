"""Pytest configuration for the shared package tests.

Ensures the `shared` package (which services import via a sys.path insert at
runtime) is importable as `shared.*` during tests, regardless of where pytest
is invoked from.
"""
from __future__ import annotations

import sys
from pathlib import Path

# services/  -> parent of the `shared` package directory
SERVICES_DIR = Path(__file__).resolve().parents[2]
if str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))
