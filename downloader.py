import yt_dlp
import os
from config_manager import get_setting

class Downloader:
    def __init__(self):
        pass

    def get_info(self, url):
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                return {
                    "title": info.get('title'),
                    "thumbnail": info.get('thumbnail'),
                    "duration": info.get('duration'),
                    "uploader": info.get('uploader'),
                    "url": url
                }
            except Exception as e:
                return {"error": str(e)}

    def download(self, url, format_type='video', save_path=None):
        if not save_path:
            save_path = get_setting('download_path')
        
        if not os.path.exists(save_path):
            os.makedirs(save_path)

        ydl_opts = {
            'outtmpl': os.path.join(save_path, '%(title)s.%(ext)s'),
        }

        if format_type == 'audio':
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        else:
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # If audio, the extension might have changed to mp3 by postprocessor
                if format_type == 'audio':
                    filename = os.path.splitext(filename)[0] + '.mp3'
                return {"success": True, "filename": filename}
            except Exception as e:
                return {"success": False, "error": str(e)}
