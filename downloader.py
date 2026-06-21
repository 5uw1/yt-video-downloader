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
            'extractor_args': {'youtube': {'player_client': ['android']}},
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                
                # Find best combined format for streaming
                formats = info.get('formats', [])
                stream_url = None
                
                # Prefer combined formats (video+audio) for simple streaming
                # Format 22 is 720p, 18 is 360p
                combined_formats = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('ext') == 'mp4']
                if combined_formats:
                    # Sort by resolution (height)
                    combined_formats.sort(key=lambda x: x.get('height', 0), reverse=True)
                    stream_url = combined_formats[0].get('url')

                # Find best audio-only format
                audio_stream_url = None
                audio_formats = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
                if audio_formats:
                    # Sort by abr
                    audio_formats.sort(key=lambda x: x.get('abr', 0), reverse=True)
                    audio_stream_url = audio_formats[0].get('url')

                return {
                    "title": info.get('title'),
                    "thumbnail": info.get('thumbnail'),
                    "duration": info.get('duration'),
                    "uploader": info.get('uploader'),
                    "url": url,
                    "stream_url": stream_url,
                    "audio_stream_url": audio_stream_url
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
            'extractor_args': {'youtube': {'player_client': ['android']}},
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
