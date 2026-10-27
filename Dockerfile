# FamilyTree as a hosted web app: one container serves the React UI, the API and uploaded photos.
# Data (SQLite + photos) lives in the /data volume. See README "Docker" for setup.

# --- 1. Build the React UI ---------------------------------------------------
FROM node:22.20.0-slim AS frontend
WORKDIR /build
COPY familytree_front/package.json familytree_front/package-lock.json ./
# --ignore-scripts: skips Electron's binary download, which a web build never uses.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY familytree_front/ ./
RUN npm run build

# --- 2. Run Django ------------------------------------------------------------
FROM python:3.12.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=0 \
    FAMILYTREE_HOST=0.0.0.0 \
    FAMILYTREE_PORT=8000 \
    FAMILYTREE_DATA_DIR=/data \
    FAMILYTREE_FRONTEND_DIR=/app/frontend
WORKDIR /app

# Server packages only, at the versions pinned in requirements.txt (that file also lists the Windows build tools).
COPY requirements.txt ./
RUN grep -iE '^(django|djangorestframework|django-cors-headers|pillow|waitress|asgiref|sqlparse|tzdata|psycopg|psycopg-binary)==' requirements.txt > server-requirements.txt \
    && pip install --no-cache-dir -r server-requirements.txt

COPY manage.py serve.py ./
COPY config/ config/
COPY familyTree/ familyTree/
COPY --from=frontend /build/dist /app/frontend

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin familytree \
    && mkdir -p /data \
    && chown familytree /data
USER familytree
VOLUME /data
EXPOSE 8000

# serve.py applies migrations, then starts Waitress.
CMD ["python", "serve.py"]
