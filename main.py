from fastapi import FastAPI, HTTPException, Query, Body, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn
import os
import shutil
import httpx
import urllib.parse
from downloader import Downloader
from config_manager import get_setting, load_config, save_config
import history_manager

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

class HistoryEntry(BaseModel):
    client_id: str
    url: str
    title: str
    thumbnail: str
    format: str
    action: str
    filename: str = None

@app.get("/download")
async def download(
    url: str = Query(...), 
    format: str = Query("video"), 
    action: str = Query("download"),
    client_id: str = Query(None),
    title: str = Query(None),
    thumbnail: str = Query(None)
):
    if action == "save":
        result = downloader.download(url, format_type=format)
        if result["success"] and client_id:
            history_manager.add_to_history(
                client_id, url, title or os.path.basename(result["filename"]), 
                thumbnail, format, "save", os.path.basename(result["filename"])
            )
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
            if client_id:
                history_manager.add_to_history(
                    client_id, url, title or filename, 
                    thumbnail, format, "download"
                )
            return FileResponse(
                path=file_path, 
                filename=filename
            )
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Download failed"))

@app.get("/api/proxy")
async def proxy_stream(request: Request, url: str = Query(...)):
    print(f"Proxying stream for URL: {url[:100]}...")
    
    # Headers to mimic a real browser/client, important for YouTube
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity", # Important for streaming
        "Connection": "keep-alive",
    }
    
    # Pass range header if present
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    async def stream_generator(client, response):
        try:
            async for chunk in response.aiter_bytes():
                yield chunk
        except Exception as e:
            print(f"Proxy generator error: {e}")
        finally:
            await response.aclose()
            await client.aclose()

    # Try to determine a reasonable media type from the URL
    media_type = "video/mp4"
    try:
        parsed_url = urllib.parse.urlparse(url)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        if 'mime' in query_params:
            media_type = query_params['mime'][0]
        elif "mime=audio" in url:
            media_type = "audio/mpeg"
    except Exception:
        pass
    
    # Increase timeout for slow streams
    timeout = httpx.Timeout(10.0, connect=30.0, read=None, write=30.0)
    client = httpx.AsyncClient(timeout=timeout)
    
    try:
        # Let's use the standard way but ensure we pass headers back
        req = client.build_request("GET", url, headers=headers)
        resp = await client.send(req, stream=True, follow_redirects=True)
        
        print(f"Proxy response status: {resp.status_code}")
        
        # Merge important headers from YouTube response
        response_headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": media_type,
        }
        
        if "Content-Range" in resp.headers:
            response_headers["Content-Range"] = resp.headers["Content-Range"]
        if "Content-Length" in resp.headers:
            response_headers["Content-Length"] = resp.headers["Content-Length"]
            
        return StreamingResponse(
            stream_generator(client, resp), 
            status_code=resp.status_code,
            headers=response_headers
        )
    except Exception as e:
        await client.aclose()
        print(f"Proxy setup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/api/history")
async def get_history(client_id: str = Query(...)):
    return history_manager.get_client_history(client_id)

@app.post("/api/history")
async def add_history(entry: HistoryEntry):
    return history_manager.add_to_history(
        entry.client_id, entry.url, entry.title, 
        entry.thumbnail, entry.format, entry.action, entry.filename
    )

@app.delete("/api/history")
async def clear_history(client_id: str = Query(...)):
    history_manager.clear_client_history(client_id)
    return {"success": True}

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
