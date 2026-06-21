from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import uvicorn
import os
from downloader import Downloader
from config_manager import get_setting, load_config, save_config

app = FastAPI()
downloader = Downloader()

class Settings(BaseModel):
    download_path: str

# Create static and downloads directory if they don't exist
for d in ["static", "downloads"]:
    if not os.path.exists(d):
        os.makedirs(d)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/downloads", StaticFiles(directory="downloads"), name="downloads")

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
                filename=filename,
                background=None # We might want to delete it after sending, but FileResponse doesn't easily support that without extra logic
            )
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Download failed"))

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
