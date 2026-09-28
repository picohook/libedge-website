FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/program
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py server.py ./
EXPOSE 8080
ENTRYPOINT ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:8080", "--access-logfile", "/dev/null", "--error-logfile", "-", "--capture-output", "server:app"]
# SageMaker may append "serve"; gunicorn ignores no positional SageMaker mode argument here,
# so the endpoint container must use this image entrypoint unchanged.
# Build/push to ECR, then deploy only by immutable image URI: <repo>@sha256:<digest>.
