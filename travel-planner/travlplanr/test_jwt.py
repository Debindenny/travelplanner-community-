from datetime import datetime, timedelta, timezone
from jose import jwt

now = datetime.now(timezone.utc)
payload = {
    "iat": now,
    "exp": now + timedelta(minutes=10080),
}
token = jwt.encode(payload, "secret", algorithm="HS256")
import base64
import json
print(json.loads(base64.b64decode(token.split('.')[1] + '==').decode('utf-8')))
