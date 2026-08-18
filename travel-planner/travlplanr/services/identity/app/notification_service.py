import os
import logging

logger = logging.getLogger(__name__)

class NotificationProvider:
    async def send_otp(self, email: str, code: str):
        pass

class MockProvider(NotificationProvider):
    async def send_otp(self, email: str, code: str):
        logger.info("mock OTP delivery", extra={"email": email, "code": code})

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

    async def send_otp(self, email: str, code: str):
        if not self.sg:
            logger.error("SendGrid client not initialized, falling back to mock")
            logger.info("mock OTP delivery", extra={"email": email, "code": code})
            return
            
        logger.info(f"Sending real OTP to {email} via SendGrid")
        message = self.Mail(
            from_email='noreply@travlplanr.com',
            to_emails=email,
            subject='Your Travlplanr Login Code',
            html_content=f'<strong>Your login code is: {code}</strong>'
        )
        try:
            import asyncio
            response = await asyncio.to_thread(self.sg.send, message)
            logger.info(f"SendGrid response: {response.status_code}")
        except Exception as e:
            logger.error(f"Failed to send OTP via SendGrid: {str(e)}")

class SMTPProvider(NotificationProvider):
    def __init__(self, host: str, port: int, user: str, password: str):
        self.host = host
        self.port = port
        self.user = user
        self.password = password

    async def send_otp(self, email: str, code: str):
        import smtplib
        from email.message import EmailMessage
        import asyncio

        def _send():
            msg = EmailMessage()
            msg.set_content(f'Your login code is: {code}')
            msg['Subject'] = 'Your Travlplanr Login Code'
            msg['From'] = 'noreply@travlplanr.com'
            msg['To'] = email

            try:
                server = smtplib.SMTP(self.host, self.port)
                server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.send_message(msg)
                server.quit()
                logger.info(f"Real OTP sent to {email} via SMTP")
            except Exception as e:
                logger.error(f"Failed to send OTP via SMTP: {str(e)}")

        await asyncio.to_thread(_send)

def get_notification_provider() -> NotificationProvider:
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if sendgrid_key:
        return SendGridProvider(sendgrid_key)
        
    smtp_host = os.environ.get("SMTP_HOST")
    if smtp_host:
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASSWORD", "")
        return SMTPProvider(smtp_host, smtp_port, smtp_user, smtp_pass)
        
    return MockProvider()
