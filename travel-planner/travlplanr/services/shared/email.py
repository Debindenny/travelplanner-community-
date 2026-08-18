"""
Minimal outbound-email seam. No provider is configured yet (no Resend/
Mailchimp/SendGrid API key), so this logs what *would* be sent rather than
actually sending — swap the body of `send_email` for a real provider call
once credentials exist, without touching any call site.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def send_email(*, to: str, subject: str, body: str) -> None:
    logger.info("Email (no provider configured, not sent) to=%s subject=%r", to, subject)
    logger.debug("Email body: %r", body)
