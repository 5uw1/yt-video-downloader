document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    const html = document.documentElement;

    const urlInput = document.getElementById('url');
    const pasteBtn = document.getElementById('pasteBtn');
    const getInfoBtn = document.getElementById('getInfoBtn');
    const actionButtons = document.getElementById('actionButtons');
    const streamBtn = document.getElementById('streamBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const saveServerBtn = document.getElementById('saveServerBtn');
    
    const videoInfo = document.getElementById('videoInfo');
    const thumbnail = document.getElementById('thumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const videoUploader = document.getElementById('videoUploader');
    const videoDuration = document.getElementById('videoDuration');
    const status = document.getElementById('status');
    
    const playback = document.getElementById('playback');
    const mediaContainer = document.getElementById('mediaContainer');
    const closePlayback = document.getElementById('closePlayback');

    const filesList = document.getElementById('filesList');

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    const downloadPathInput = document.getElementById('downloadPath');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    let currentVideoData = null;
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem('clientId', clientId);
    }

    // Theme Management
    const toggleTheme = () => {
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.add('dark');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            localStorage.setItem('theme', 'dark');
        }
    };

    themeToggle.addEventListener('click', toggleTheme);

    // Initialize Theme
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }

    // Clipboard Paste
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
        } catch (err) {
            showStatus('Could not access clipboard', 'error');
        }
    });

    // Helper: Show Status
    const showStatus = (message, type = 'info') => {
        status.textContent = message;
        status.className = `p-4 rounded-lg text-center font-medium ${type}`;
        status.classList.remove('hidden');
        if (type !== 'info') {
            // Keep error/success for 5 seconds
            setTimeout(() => {
                if (status.textContent === message) status.classList.add('hidden');
            }, 5000);
        }
    };

    // Helper: Format Duration
    const formatSeconds = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h, m, s].map(v => v < 10 ? "0" + v : v).filter((v, i) => v !== "00" || i > 0).join(":");
    };

    // Get Video Info
    getInfoBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showStatus('Please enter a URL', 'error');
            return;
        }

        showStatus('Fetching video information...', 'info');
        getInfoBtn.disabled = true;
        getInfoBtn.classList.add('opacity-50');

        try {
            const response = await fetch(`/info?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (data.error) {
                showStatus(data.error, 'error');
                videoInfo.classList.add('hidden');
                actionButtons.classList.add('hidden');
            } else {
                currentVideoData = data;
                thumbnail.src = data.thumbnail;
                videoTitle.textContent = data.title;
                videoUploader.textContent = data.uploader;
                videoDuration.textContent = `Duration: ${formatSeconds(data.duration)}`;
                
                videoInfo.classList.remove('hidden');
                actionButtons.classList.remove('hidden');
                status.classList.add('hidden');
            }
        } catch (err) {
            showStatus('Failed to connect to server', 'error');
        } finally {
            getInfoBtn.disabled = false;
            getInfoBtn.classList.remove('opacity-50');
        }
    });

    // Stream Video
    streamBtn.addEventListener('click', async () => {
        if (!currentVideoData) {
            showStatus('Video data not available', 'error');
            return;
        }
        
        const format = document.querySelector('input[name="format"]:checked').value;
        const url = format === 'video' ? currentVideoData.stream_url : (currentVideoData.audio_stream_url || currentVideoData.stream_url);
        
        if (!url) {
            showStatus('Stream URL not available', 'error');
            return;
        }

        // Record history for stream
        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    url: currentVideoData.url,
                    title: currentVideoData.title,
                    thumbnail: currentVideoData.thumbnail,
                    format: format,
                    action: 'stream'
                })
            });
            loadHistory();
        } catch (err) {
            console.error('Failed to record stream history', err);
        }
        
        showPlayback(url, format, true);
    });

    // Download to Local
    downloadBtn.addEventListener('click', async () => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const url = urlInput.value.trim();
        const title = currentVideoData ? currentVideoData.title : '';
        const thumbnail = currentVideoData ? currentVideoData.thumbnail : '';
        
        showStatus('Preparing download...', 'info');
        window.location.href = `/download?url=${encodeURIComponent(url)}&format=${format}&action=download&client_id=${clientId}&title=${encodeURIComponent(title)}&thumbnail=${encodeURIComponent(thumbnail)}`;
        
        // Refresh history after a short delay since download is a navigation
        setTimeout(loadHistory, 2000);
    });

    // Save to Server
    saveServerBtn.addEventListener('click', async () => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const url = urlInput.value.trim();
        const title = currentVideoData ? currentVideoData.title : '';
        const thumbnail = currentVideoData ? currentVideoData.thumbnail : '';
        
        showStatus('Saving to server...', 'info');
        try {
            const response = await fetch(`/download?url=${encodeURIComponent(url)}&format=${format}&action=save&client_id=${clientId}&title=${encodeURIComponent(title)}&thumbnail=${encodeURIComponent(thumbnail)}`);
            const data = await response.json();
            
            if (data.success) {
                showStatus(`Saved successfully: ${data.filename}`, 'success');
                loadFiles();
                loadHistory();
                showPlayback(data.filename, format);
            } else {
                showStatus(`Error: ${data.error}`, 'error');
            }
        } catch (err) {
            showStatus('Failed to connect to server', 'error');
        }
    });

    const loadFiles = async () => {
        try {
            const response = await fetch('/api/files');
            const files = await response.json();
            
            if (files.length === 0) {
                filesList.innerHTML = '<p class="text-gray-500 italic">No files saved on server yet.</p>';
                return;
            }

            filesList.innerHTML = '';
            files.forEach(file => {
                const isVideo = file.toLowerCase().endsWith('.mp4');
                const fileItem = document.createElement('div');
                fileItem.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg group';
                
                const fileInfo = document.createElement('div');
                fileInfo.className = 'flex items-center space-x-3 overflow-hidden';
                
                const icon = document.createElement('div');
                icon.innerHTML = isVideo ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>' :
                    '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>';
                
                const fileName = document.createElement('span');
                fileName.className = 'text-sm font-medium truncate';
                fileName.textContent = file;
                fileName.title = file;

                fileInfo.appendChild(icon);
                fileInfo.appendChild(fileName);

                const actions = document.createElement('div');
                actions.className = 'flex space-x-2 shrink-0';

                const playBtn = document.createElement('button');
                playBtn.className = 'p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors';
                playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
                playBtn.onclick = () => showPlayback(file, isVideo ? 'video' : 'audio');

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors';
                deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
                deleteBtn.onclick = async () => {
                    if (confirm(`Are you sure you want to delete "${file}"?`)) {
                        try {
                            const delResponse = await fetch(`/api/files/${encodeURIComponent(file)}`, { method: 'DELETE' });
                            if (delResponse.ok) {
                                loadFiles();
                            }
                        } catch (err) {
                            showStatus('Failed to delete file', 'error');
                        }
                    }
                };

                actions.appendChild(playBtn);
                actions.appendChild(deleteBtn);

                fileItem.appendChild(fileInfo);
                fileItem.appendChild(actions);
                filesList.appendChild(fileItem);
            });
        } catch (err) {
            console.error('Failed to load files:', err);
        }
    };

    const showPlayback = (url, format, isStream = false) => {
        let mediaUrl;
        if (isStream) {
            mediaUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        } else {
            mediaUrl = `/api/media/${encodeURIComponent(url.split('/').pop())}`;
        }
        
        mediaContainer.innerHTML = '';
        let mediaElement;

        if (format === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.autoplay = true;
            mediaElement.className = 'w-full rounded-lg';
            const source = document.createElement('source');
            source.src = mediaUrl;
            source.type = 'video/mp4';
            mediaElement.appendChild(source);
        } else {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
            mediaElement.autoplay = true;
            mediaElement.className = 'w-full mt-4';
            const source = document.createElement('source');
            source.src = mediaUrl;
            source.type = 'audio/mpeg';
            mediaElement.appendChild(source);
        }

        mediaContainer.appendChild(mediaElement);
        playback.classList.remove('hidden');
        playback.scrollIntoView({ behavior: 'smooth' });
    };

    closePlayback.addEventListener('click', () => {
        mediaContainer.innerHTML = '';
        playback.classList.add('hidden');
    });

    // Settings Modal
    settingsBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/settings');
            const config = await response.json();
            downloadPathInput.value = config.download_path;
            settingsModal.classList.remove('hidden');
        } catch (err) {
            showStatus('Failed to load settings', 'error');
        }
    });

    closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    saveSettings.addEventListener('click', async () => {
        const newPath = downloadPathInput.value.trim();
        try {
            const response = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ download_path: newPath })
            });
            if (response.ok) {
                showStatus('Settings saved', 'success');
                settingsModal.classList.add('hidden');
                loadFiles();
            } else {
                showStatus('Failed to save settings', 'error');
            }
        } catch (err) {
            showStatus('Failed to connect to server', 'error');
        }
    });

    const loadHistory = async () => {
        try {
            const response = await fetch(`/api/history?client_id=${clientId}`);
            const history = await response.json();
            
            if (history.length === 0) {
                historyList.innerHTML = '<p class="text-gray-500 italic">No history yet.</p>';
                return;
            }

            historyList.innerHTML = '';
            history.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'flex space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer group';
                
                const thumb = document.createElement('img');
                thumb.src = item.thumbnail;
                thumb.className = 'w-24 h-14 object-cover rounded';
                
                const info = document.createElement('div');
                info.className = 'flex-1 min-w-0';
                
                const title = document.createElement('h4');
                title.className = 'text-sm font-bold truncate';
                title.textContent = item.title;
                
                const meta = document.createElement('p');
                meta.className = 'text-xs text-gray-500 dark:text-gray-400';
                const date = new Date(item.timestamp).toLocaleDateString();
                meta.textContent = `${item.action.toUpperCase()} • ${item.format} • ${date}`;
                
                info.appendChild(title);
                info.appendChild(meta);
                
                itemEl.appendChild(thumb);
                itemEl.appendChild(info);
                
                itemEl.onclick = async () => {
                    urlInput.value = item.url;
                    // If it was a saved file, try to play it directly
                    if (item.action === 'save' && item.filename) {
                        showPlayback(item.filename, item.format);
                    } else {
                        // Otherwise, get info first
                        getInfoBtn.click();
                    }
                };
                
                historyList.appendChild(itemEl);
            });
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear your history?')) {
            try {
                const response = await fetch(`/api/history?client_id=${clientId}`, { method: 'DELETE' });
                if (response.ok) {
                    loadHistory();
                }
            } catch (err) {
                showStatus('Failed to clear history', 'error');
            }
        }
    });

    loadFiles();
    loadHistory();
});
