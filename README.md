# YouTube Downloader Web App

A lightweight, user-friendly web application to download YouTube videos as video (MP4) or audio (MP3).

## Features

- **YouTube URL Input:** Easily paste URLs from your clipboard.
- **Video/Audio Support:** Choose between MP4 video or MP3 audio.
- **Dual Download Options:**
  - **Download to Device:** Streams the file directly to your browser.
  - **Save to Server:** Saves the file to the server's storage and allows instant playback.
- **In-App Playback:** Play saved videos or audio directly within the application.
- **Persistent Settings:** Configure the server-side download path via the settings menu.
- **Dark/Light Mode:** Full support for system themes and manual toggling.
- **Docker Support:** Ready to be deployed as a container.

## Technical Stack

- **Backend:** FastAPI (Python)
- **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript
- **Downloader Logic:** `yt-dlp`
- **Package Management:** `uv`
- **Containerization:** Docker & Docker Compose

## Getting Started

### Prerequisites

- [uv](https://github.com/astral-sh/uv) (for local development)
- [Docker](https://www.docker.com/) (for containerized deployment)
- **FFmpeg** (must be installed on your system for media conversion)

### Running with Docker (Recommended)

The easiest way to run the application is using Docker Compose:

```bash
# Using the provided script
chmod +x run_docker.sh
./run_docker.sh
```

Or manually:

```bash
docker compose up -d
```

The app will be available at `http://localhost:8000`.

### Deploying from Docker Hub

To run the application on another computer without cloning the source code, you can use the following `docker-compose.yml` example:

```yaml
services:
  youtube-downloader:
    image: 5uw1/yb-video-downloader:latest
    container_name: youtube-downloader
    ports:
      - "8000:8000"
    volumes:
      - ./downloads:/app/downloads
      - ./config.json:/app/config.json
    restart: unless-stopped
```

Once you have this file, simply run:
```bash
docker compose up -d
```

### Running Locally

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Run the application:
   ```bash
   uv run python main.py
   ```

3. Open `http://localhost:8000` in your browser.

## Configuration

Settings are stored in `config.json` on the server. You can modify the download path through the UI settings menu.

## License

MIT
