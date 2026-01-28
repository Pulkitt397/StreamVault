/**
 * StreamVault Downloader
 * Downloads videos with progress tracking
 */

const CONFIG = {
    // Primary backend (your phone via Cloudflare Quick Tunnel)
    PRIMARY_BACKEND: 'https://conclusions-pillow-materials-examples.trycloudflare.com',
    // Fallback backend
    FALLBACK_BACKEND: 'https://streamvault-backend.onrender.com'
};

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusArea = document.getElementById('statusArea');
    const statusText = document.getElementById('statusText');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const tabs = document.querySelectorAll('.tab-btn');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const pasteBtn = document.getElementById('pasteBtn');

    let activeBackend = CONFIG.PRIMARY_BACKEND;
    let selectedQuality = 'best';
    let selectedFormat = 'video';
    let downloadController = null;

    // Check for URL param
    const urlParams = new URLSearchParams(window.location.search);
    const prefillUrl = urlParams.get('url');
    if (prefillUrl) {
        urlInput.value = decodeURIComponent(prefillUrl);
    }

    // Check backend connectivity
    checkBackend();

    // Tab Selection
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            selectedQuality = tab.dataset.value;
        });
    });

    // Toggle Selection
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedFormat = btn.dataset.value;
        });
    });

    // Paste Button
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    urlInput.value = text;
                    urlInput.focus();
                    pasteBtn.innerHTML = '<i class="fas fa-check" style="color: var(--primary)"></i>';
                    setTimeout(() => pasteBtn.innerHTML = '<i class="fas fa-paste"></i>', 1500);
                }
            } catch (err) {
                console.error('Clipboard access denied', err);
                alert('Clipboard permission denied.');
            }
        });
    }

    // Download Handler
    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a valid URL');
            return;
        }

        const audioOnly = selectedFormat === 'audio';

        // UI Loading State
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<div class="simple-spinner"></div> Preparing...';
        statusArea.style.display = 'block';
        progressContainer.style.display = 'none';
        statusText.innerText = 'Fetching video info...';
        statusText.style.color = 'var(--text-secondary)';

        try {
            // Step 1: Get video info for filename and size
            const infoUrl = `${activeBackend}/info?url=${encodeURIComponent(url)}&quality=${selectedQuality}&audio_only=${audioOnly}`;
            const infoRes = await fetch(infoUrl, { signal: AbortSignal.timeout(30000) });

            if (!infoRes.ok) {
                throw new Error('Failed to fetch video info');
            }

            const info = await infoRes.json();
            const filename = sanitizeFilename(info.title || 'video.mp4');
            const totalSize = info.filesize || 0;

            statusText.innerText = `Downloading: ${filename}`;

            // Show progress bar
            if (totalSize > 0) {
                progressContainer.style.display = 'block';
                progressBar.style.width = '0%';
                progressText.innerText = '0%';
            } else {
                // Indeterminate progress
                progressContainer.style.display = 'block';
                progressBar.classList.add('indeterminate');
                progressText.innerText = 'Downloading...';
            }

            // Step 2: Download with progress
            const downloadUrl = `${activeBackend}/stream?url=${encodeURIComponent(url)}&download=true`;
            downloadController = new AbortController();

            const response = await fetch(downloadUrl, { signal: downloadController.signal });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                // Update progress
                if (totalSize > 0) {
                    const percent = Math.min(100, (receivedLength / totalSize) * 100);
                    progressBar.style.width = `${percent}%`;
                    progressText.innerText = `${percent.toFixed(1)}% (${formatBytes(receivedLength)} / ${formatBytes(totalSize)})`;
                } else {
                    progressText.innerText = `Downloaded: ${formatBytes(receivedLength)}`;
                }
            }

            // Step 3: Create and trigger download
            progressBar.classList.remove('indeterminate');
            progressBar.style.width = '100%';
            progressText.innerText = 'Processing...';

            const blob = new Blob(chunks);
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            // Success
            statusText.innerText = '✓ Download complete!';
            statusText.style.color = '#22c55e';
            progressText.innerText = `Saved: ${filename}`;

            setTimeout(() => resetUI(), 5000);

        } catch (error) {
            console.error('Download failed:', error);

            if (error.name === 'AbortError') {
                statusText.innerText = 'Download cancelled';
            } else {
                statusText.innerText = `Error: ${error.message}`;
            }
            statusText.style.color = '#ef4444';
            progressBar.classList.remove('indeterminate');

            setTimeout(() => resetUI(), 3000);
        }
    });

    function resetUI() {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Start Download';
        statusArea.style.display = 'none';
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressBar.classList.remove('indeterminate');
        statusText.style.color = 'var(--text-secondary)';
    }

    async function checkBackend() {
        // 1. Get stored URL or default
        let targetUrl = localStorage.getItem('sv_backend_url') || CONFIG.PRIMARY_BACKEND;

        try {
            statusText.innerText = 'Connecting to backend...';
            // Simple ping
            await fetch(targetUrl + '/', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(3000)
            });
            console.log('Connected to:', targetUrl);
            activeBackend = targetUrl;

            // Visual indicator on download page
            statusArea.style.display = 'block';
            statusText.innerText = '● Connected to Phone';
            statusText.style.color = '#22c55e';
            statusArea.style.background = 'rgba(34, 197, 94, 0.1)';
            setTimeout(() => { statusArea.style.display = 'none'; }, 2000);

        } catch (e) {
            console.log('Backend not reachable:', e);

            // If download page, we assume they WANT to download, so we prompt immediately if it fails
            const newUrl = prompt("🔴 Backend Offline!\n\nPaste your new Cloudflare URL from Termux:\n(Starts with https://...trycloudflare.com)");
            if (newUrl) {
                const cleanUrl = newUrl.trim().replace(/\/$/, "");
                localStorage.setItem('sv_backend_url', cleanUrl);
                activeBackend = cleanUrl;
                checkBackend(); // Retry
            } else {
                // Fallback
                activeBackend = CONFIG.FALLBACK_BACKEND;
            }
        }
    }

    function sanitizeFilename(name) {
        return name.replace(/[^a-zA-Z0-9._\- ]/g, '_').substring(0, 200);
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
});
