FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY services/shared /app/shared
RUN pip install --no-cache-dir /app/shared
COPY services/reporting/pyproject.toml .
RUN pip install --no-cache-dir .
COPY services/reporting/alembic.ini .
COPY services/reporting/alembic ./alembic
COPY services/reporting/app ./app

EXPOSE 8000

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
