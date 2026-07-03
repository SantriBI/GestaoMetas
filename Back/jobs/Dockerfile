# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

COPY requirements-prefect.txt .
RUN pip install --no-cache-dir -r requirements-prefect.txt

COPY jobs/ jobs/

CMD ["python", "-m", "jobs.run_prefect", "serve"]
