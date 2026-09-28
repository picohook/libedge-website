FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/program
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py server.py ./
EXPOSE 8080
ENTRYPOINT ["python", "server.py"]
# SageMaker invokes the image with the optional "serve" argument; server.py accepts it.
# Build/push to ECR, then deploy only by immutable image URI: <repo>@sha256:<digest>.
