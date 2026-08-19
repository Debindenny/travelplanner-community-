FROM python:3.12-slim
WORKDIR /app
COPY services/shared /app/shared
RUN pip install --no-cache-dir /app/shared
COPY services/ai-worker/pyproject.toml .
RUN pip install --no-cache-dir .
COPY services/ai-worker/app ./app
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "-m", "app.main"]
