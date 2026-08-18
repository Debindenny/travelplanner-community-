"""Booking reference (PNR) generation."""

import secrets
import string

_PNR_ALPHABET = string.ascii_uppercase + string.digits


def generate_pnr() -> str:
    """Generate a 6-character uppercase alphanumeric booking reference."""
    return "".join(secrets.choice(_PNR_ALPHABET) for _ in range(6))
