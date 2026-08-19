"""Root conftest for backend tests.

Makes the `shared` package importable as `shared.*` from any service test,
mirroring the runtime `sys.path` insert each service does in its `main.py`.
Run the whole suite with:  pytest services
"""
from __future__ import annotations

import sys
from pathlib import Path

SERVICES_DIR = Path(__file__).resolve().parent
if str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))
