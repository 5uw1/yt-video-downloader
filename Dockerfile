# Use a slim Python image
FROM python:3.11-slim-bookworm

# Install ffmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
# Copy only necessary files for dependency installation to leverage cache
ENV UV_LINK_MODE=copy

# Copy project files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-install-project

# Copy the rest of the application
COPY . .

# Ensure downloads and config directories exist
RUN mkdir -p downloads temp_downloads config

# Expose the port FastAPI runs on
EXPOSE 8000

# Run the application
CMD ["uv", "run", "python", "main.py"]
