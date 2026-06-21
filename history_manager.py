import json
import os
from datetime import datetime
import uuid

HISTORY_FILE = "config/history.json"

def load_history():
    if not os.path.exists("config"):
        os.makedirs("config")
    
    if not os.path.exists(HISTORY_FILE):
        return []
    
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

def save_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

def add_to_history(client_id, url, title, thumbnail, format_type, action, filename=None):
    history = load_history()
    
    entry = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "url": url,
        "title": title,
        "thumbnail": thumbnail,
        "format": format_type,
        "action": action,
        "filename": filename,
        "timestamp": datetime.now().isoformat()
    }
    
    # Keep only the last 50 entries per client or total? 
    # Let's just keep last 100 total for now to prevent file bloat
    history.insert(0, entry)
    history = history[:100]
    
    save_history(history)
    return entry

def get_client_history(client_id):
    history = load_history()
    return [e for e in history if e["client_id"] == client_id]

def clear_client_history(client_id):
    history = load_history()
    new_history = [e for e in history if e["client_id"] != client_id]
    save_history(new_history)
