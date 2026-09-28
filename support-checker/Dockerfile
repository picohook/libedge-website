FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/program
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
ARG FRESH_CHECKER_MODEL="MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
ARG FRESH_CHECKER_REVISION="6f5cf0a2b59cabb106aca4c287eed12e357e90eb"
ENV FRESH_CHECKER_MODEL_PATH=/opt/model HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
RUN HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='\${FRESH_CHECKER_MODEL}', revision='\${FRESH_CHECKER_REVISION}', local_dir='/opt/model')"
COPY app.py server.py ./
EXPOSE 8080
ENTRYPOINT ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:8080", "--access-logfile", "/dev/null", "--error-logfile", "-", "--capture-output", "server:app"]
# SageMaker may append "serve"; gunicorn ignores no positional SageMaker mode argument here,
# so the endpoint container must use this image entrypoint unchanged.
# Build/push to ECR, then deploy only by immutable image URI: <repo>@sha256:<digest>.
