FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/program
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py /opt/ml/code/inference.py
ENV SAGEMAKER_PROGRAM=inference.py
# Build/push to ECR, then deploy only by immutable image URI: <repo>@sha256:<digest>.
