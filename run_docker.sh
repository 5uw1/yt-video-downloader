#!/bin/bash

# Build the Docker image
echo "Building Docker image..."
docker compose build

# Run the container in detached mode
echo "Starting YouTube Downloader..."
docker compose up -d

echo "Application is running at http://localhost:8000"
