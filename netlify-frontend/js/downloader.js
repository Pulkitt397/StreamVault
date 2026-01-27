
const CONFIG = {
    // Primary backend (your phone via Cloudflare tunnel)
    // Same configuration as player.js
    PRIMARY_BACKEND: 'https://uri-stored-expand-revolutionary.trycloudflare.com',

    // Fallback backend
    FALLBACK_BACKEND: 'https://streamvault-backend.onrender.com'
};

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusArea = document.getElementById('statusArea');
    const statusText = document.getElementById('statusText');
    const tabs = document.querySelectorAll('.tab-btn');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    let activeBackend = CONFIG.PRIMARY_BACKEND;
    let selectedQuality = 'best';
    let selectedFormat = 'video';

    // Check for URL param
    const urlParams = new URLSearchParams(window.location.search);
    const prefillUrl = urlParams.get('url');
    if (prefillUrl) {
        urlInput.value = decodeURIComponent(prefillUrl);
    }

    // check backend connectivity
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

    // Download Handler
    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a valid URL');
            return;
        }

        // UI Loading State
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Processing...';
        statusArea.style.display = 'block';
        statusText.innerText = 'Extracting link and preparing download...';

        try {
            // Construct Download URL
            // Note: For now, we are using the simple proxy /stream endpoint with download=true
            // Future enhancement: Pass quality/format to backend if implemented
            const downloadUrl = `${activeBackend}/stream?url=${encodeURIComponent(url)}&download=true`;

            // Trigger Download
            // We use a hidden iframe or simple window location to trigger the browser download
            // without navigating away, or create a temporary anchor
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = ''; // Browser will try to use filename from header
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            statusText.innerText = 'Download started!';
            setTimeout(() => {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Start Download';
                statusArea.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('Download setup failed:', error);
            statusText.innerText = 'Error: Could not reach backend.';
            statusText.style.color = '#ef4444';
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Retry';
        }
    });

    async function checkBackend() {
        try {
            await fetch(CONFIG.PRIMARY_BACKEND + '/', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(3000)
            });
            console.log('Connected to Phone Backend');
            activeBackend = CONFIG.PRIMARY_BACKEND;
        } catch (e) {
            console.log('Phone backend unreachable, using fallback');
            activeBackend = CONFIG.FALLBACK_BACKEND;
        }
    }
});
