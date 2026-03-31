# Enable Docker BuildKit features for better caching and performance
# syntax=docker/dockerfile:1

# ============================================================================
# Stage 1: Build Frontend
# Compiles the React/Vite frontend into static HTML/JS/CSS assets
# Uses a separate stage so Node.js is NOT included in the final image
# ============================================================================
# Use Alpine-based Node image for a smaller download (~50MB vs ~350MB)
FROM node:20-alpine AS frontend-builder
# Set the working directory for frontend build commands
WORKDIR /frontend
# Copy package files first to leverage Docker layer caching
# If dependencies haven't changed, this layer is reused from cache
COPY app/frontend/package.json app/frontend/package-lock.json* ./
# Install dependencies using clean install (ci) for reproducible builds
# Falls back to npm install if no lock file exists
RUN npm ci --prefer-offline 2>/dev/null || npm install
# Copy the rest of the frontend source code
COPY app/frontend/ ./
# Build the production bundle (outputs to /frontend/dist)
RUN npm run build

# ============================================================================
# Stage 2: Build Python Wheels
# Pre-compiles Python dependencies into wheel files for faster installation
# Uses a separate stage so build tools (gcc) are NOT in the final image
# ============================================================================
# Use slim Debian image with Python 3.10 (smaller than full image)
FROM python:3.10-slim-bookworm AS backend-builder
# Set the working directory for backend build commands
WORKDIR /backend
# Install build dependencies needed to compile C extensions (e.g. psycopg2)
# Retry loop handles transient network failures during apt-get
RUN for i in 1 2 3; do \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* && \
      apt-get update && \
      # gcc: C compiler for building Python C extensions
      # libpq-dev: PostgreSQL client headers needed to compile psycopg2
      apt-get install -y --no-install-recommends gcc libpq-dev && \
      break || sleep 5; \
    done && rm -rf /var/lib/apt/lists/*
# Copy only requirements.txt first to leverage Docker layer caching
COPY app/backend/requirements.txt ./
# Upgrade pip and build wheel files for all dependencies
# Wheels are pre-compiled binaries that install much faster
RUN pip install --upgrade pip \
  && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ============================================================================
# Stage 3: Runtime
# The final production image - only contains what's needed to run the app
# This is the image that gets deployed to ECS Fargate
# ============================================================================
# Use the same slim Debian base for compatibility with the built wheels
FROM python:3.10-slim-bookworm AS runtime
# PYTHONDONTWRITEBYTECODE=1: Prevents .pyc file creation (reduces image size)
# PYTHONUNBUFFERED=1: Ensures logs appear immediately (not buffered)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
# Set the working directory for the application
WORKDIR /app

# Install runtime-only dependencies (no compiler needed)
# Retry loop handles transient network failures
RUN for i in 1 2 3; do \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* && \
      apt-get update && \
      # libpq5: PostgreSQL client library needed at runtime by psycopg2
      # curl: Used by the container health check to verify the app is running
      apt-get install -y --no-install-recommends libpq5 curl && \
      break || sleep 5; \
    done && rm -rf /var/lib/apt/lists/* \
    # Create a non-root user for security (UID 10001 avoids conflicts)
    # Running as non-root follows the principle of least privilege
    && useradd -m -u 10001 appuser

# Copy pre-built wheels from the builder stage and install them
# --no-cache-dir prevents pip from caching downloads (reduces image size)
COPY --from=backend-builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy the backend application source code into the container
COPY app/backend/ /app/backend/
# Copy the compiled frontend assets from the frontend builder stage
# These are served as static files by the FastAPI backend
COPY --from=frontend-builder /frontend/dist /app/backend/app/static/

# Set the working directory to the backend app for the CMD
WORKDIR /app/backend
# Switch to the non-root user for security
# All subsequent commands and the running process use this user
USER appuser
# Document that the container listens on port 8080
# This is informational - the actual port binding happens in the CMD
EXPOSE 8080
# Start the FastAPI application using Uvicorn ASGI server
# --host 0.0.0.0: Listen on all interfaces (required for container networking)
# --port 8080: Match the EXPOSE port and ECS task definition
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
