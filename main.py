from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn
import os
import shutil
import httpx
from downloader import Downloader
from config_manager import get_setting, load_config, save_config

app = FastAPI()
downloader = Downloader()

class Settings(BaseModel):
    download_path: str

# Create static directory if it doesn't exist
for d in ["static", "downloads"]:
    if not os.path.exists(d):
        os.makedirs(d)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("static/index.html", "r") as f:
        return f.read()

@app.get("/info")
async def get_info(url: str = Query(...)):
    info = downloader.get_info(url)
    if "error" in info:
        raise HTTPException(status_code=400, detail=info["error"])
    return info

@app.get("/download")
async def download(
    url: str = Query(...), 
    format: str = Query("video"), 
    action: str = Query("download")
):
    if action == "save":
        result = downloader.download(url, format_type=format)
        return result
    else:
        # For direct download, we download to a temp folder first then stream
        temp_dir = "temp_downloads"
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        result = downloader.download(url, format_type=format, save_path=temp_dir)
        if result["success"]:
            file_path = result["filename"]
            filename = os.path.basename(file_path)
            return FileResponse(
                path=file_path, 
                filename=filename
            )
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Download failed"))

@app.get("/api/proxy")
async def proxy_stream(url: str = Query(...)):
    async def stream_generator():
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", url, follow_redirects=True) as response:
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except Exception as e:
            print(f"Proxy error: {e}")

    # Try to determine a reasonable media type, default to video/mp4
    media_type = "video/mp4"
    if "googlevideo.com" in url:
        if "mime=audio" in url:
            media_type = "audio/mpeg"
    
    return StreamingResponse(stream_generator(), media_type=media_type)

@app.get("/api/files")
async def list_files():
    download_path = get_setting("download_path")
    if not os.path.exists(download_path):
        return []
    files = []
    for f in os.listdir(download_path):
        if os.path.isfile(os.path.join(download_path, f)) and not f.startswith('.'):
            files.append(f)
    return sorted(files)

@app.get("/api/media/{filename}")
async def serve_media(filename: str):
    download_path = get_setting("download_path")
    file_path = os.path.join(download_path, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.delete("/api/files/{filename}")
async def delete_file(filename: str):
    download_path = get_setting("download_path")
    file_path = os.path.join(download_path, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"success": True}
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/settings")
async def get_settings():
    return load_config()

@app.post("/settings")
async def update_settings(settings: Settings):
    config = load_config()
    config["download_path"] = settings.download_path
    save_config(config)
    return {"success": True}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
