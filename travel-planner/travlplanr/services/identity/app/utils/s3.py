import os
import boto3
import logging
from botocore.exceptions import ClientError
from botocore.client import Config
import asyncio

logger = logging.getLogger(__name__)

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "travlplanr-uploads")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_PUBLIC_DOMAIN = os.getenv("S3_PUBLIC_DOMAIN", "http://localhost:9000/travlplanr-uploads") # For local dev

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT if "minio" in S3_ENDPOINT or "localhost" in S3_ENDPOINT else None,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
        config=Config(signature_version='s3v4')
    )

async def upload_file_to_s3(file_bytes: bytes, object_name: str, content_type: str = "image/jpeg") -> str:
    """
    Uploads bytes to S3 and returns the public URL.
    """
    s3_client = get_s3_client()
    try:
        await asyncio.to_thread(
            s3_client.put_object,
            Bucket=S3_BUCKET,
            Key=object_name,
            Body=file_bytes,
            ContentType=content_type,
        )
        return f"{S3_PUBLIC_DOMAIN}/{object_name}"
    except ClientError as e:
        logger.error(f"Error uploading to S3: {e}")
        return f"/static/uploads/{object_name}" # fallback
