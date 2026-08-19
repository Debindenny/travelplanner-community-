import os
import logging

logger = logging.getLogger(__name__)

class NotificationProvider:
    async def send_trip_invite(self, email: str, token: str, trip_title: str, inviter_name: str):
        pass

class MockProvider(NotificationProvider):
    async def send_trip_invite(self, email: str, token: str, trip_title: str, inviter_name: str):
        logger.info(
            "mock trip invite delivery",
            extra={"email": email, "token": token, "trip_title": trip_title, "inviter_name": inviter_name}
        )

class SendGridProvider(NotificationProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail
            self.sg = sendgrid.SendGridAPIClient(api_key=self.api_key)
            self.Mail = Mail
        except ImportError:
            logger.warning("sendgrid is not installed but SENDGRID_API_KEY is present.")
            self.sg = None

    async def send_trip_invite(self, email: str, token: str, trip_title: str, inviter_name: str):
        if not self.sg:
            logger.error("SendGrid client not initialized, falling back to mock")
            logger.info(
                "mock trip invite delivery",
                extra={"email": email, "token": token, "trip_title": trip_title, "inviter_name": inviter_name}
            )
            return
            
        logger.info(f"Sending real trip invite to {email} via SendGrid")
        invite_link = f"https://app.travlplanr.com/invite/{token}"
        message = self.Mail(
            from_email='noreply@travlplanr.com',
            to_emails=email,
            subject=f"{inviter_name} invited you to collaborate on '{trip_title}'",
            html_content=f'''
            <p>Hi there,</p>
            <p><strong>{inviter_name}</strong> has invited you to collaborate on the trip <strong>{trip_title}</strong> on Travlplanr!</p>
            <p>Click the link below to accept the invitation and start planning together:</p>
            <p><a href="{invite_link}">{invite_link}</a></p>
            <p>Happy travels,<br>The Travlplanr Team</p>
            '''
        )
        try:
            import asyncio
            response = await asyncio.to_thread(self.sg.send, message)
            logger.info(f"SendGrid response: {response.status_code}")
        except Exception as e:
            logger.error(f"Failed to send trip invite via SendGrid: {str(e)}")

def get_notification_provider() -> NotificationProvider:
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if sendgrid_key:
        return SendGridProvider(sendgrid_key)
    return MockProvider()
