document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    const html = document.documentElement;

    const urlInput = document.getElementById('url');
    const pasteBtn = document.getElementById('pasteBtn');
    const getInfoBtn = document.getElementById('getInfoBtn');
    const actionButtons = document.getElementById('actionButtons');
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

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    const downloadPathInput = document.getElementById('downloadPath');

    let currentVideoData = null;

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

    // Download to Local
    downloadBtn.addEventListener('click', async () => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const url = urlInput.value.trim();
        
        showStatus('Preparing download...', 'info');
        window.location.href = `/download?url=${encodeURIComponent(url)}&format=${format}&action=download`;
    });

    // Save to Server
    saveServerBtn.addEventListener('click', async () => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const url = urlInput.value.trim();
        
        showStatus('Saving to server...', 'info');
        try {
            const response = await fetch(`/download?url=${encodeURIComponent(url)}&format=${format}&action=save`);
            const data = await response.json();
            
            if (data.success) {
                showStatus(`Saved successfully: ${data.filename}`, 'success');
                showPlayback(data.filename, format);
            } else {
                showStatus(`Error: ${data.error}`, 'error');
            }
        } catch (err) {
            showStatus('Failed to connect to server', 'error');
        }
    });

    const showPlayback = (filePath, format) => {
        const filename = filePath.split('/').pop();
        const mediaUrl = `/downloads/${encodeURIComponent(filename)}`;
        
        mediaContainer.innerHTML = '';
        let mediaElement;

        if (format === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.className = 'w-full rounded-lg';
            const source = document.createElement('source');
            source.src = mediaUrl;
            source.type = 'video/mp4';
            mediaElement.appendChild(source);
        } else {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
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
            } else {
                showStatus('Failed to save settings', 'error');
            }
        } catch (err) {
            showStatus('Failed to connect to server', 'error');
        }
    });
});
