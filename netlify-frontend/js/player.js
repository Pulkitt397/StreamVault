// StreamVault Frontend - Connects to Phone Backend via Cloudflare Tunnel
// Configure your backend URLs here

const CONFIG = {
    // Primary backend (your phone via Cloudflare tunnel)
    // UPDATE THIS with your current cloudflared URL
    PRIMARY_BACKEND: 'https://conclusions-pillow-materials-examples.trycloudflare.com',

    // Fallback backend (Render - always available)
    // UPDATE THIS with your Render URL
    FALLBACK_BACKEND: 'https://streamvault.onrender.com',

    // Set to true to always use fallback
    USE_FALLBACK_ONLY: false
};

let activeBackend = CONFIG.PRIMARY_BACKEND;

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const video = document.getElementById('videoEl');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const seekSlider = document.getElementById('seekSlider');
    const volumeSlider = document.getElementById('volumeSlider');
    const fsBtn = document.getElementById('fsBtn');
    const currentTimeText = document.getElementById('currentTime');
    const durationText = document.getElementById('duration');
    const spinner = document.getElementById('spinner');
    const container = document.getElementById('playerContainer');

    // Action Logic Elements
    const loadBtn = document.getElementById('loadBtn');
    const urlInput = document.getElementById('urlInput');
    const actionModal = document.getElementById('actionModal');
    const downloadActionBtn = document.getElementById('downloadActionBtn');
    const streamActionBtn = document.getElementById('streamActionBtn');

    // Status Elements
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusBar = document.getElementById('statusBar');

    let isPlaying = false;
    let currentUrl = "";

    // --- Dynamic Backend Management ---

    function getStoredBackend() {
        return localStorage.getItem('sv_backend_url') || CONFIG.PRIMARY_BACKEND;
    }

    function setStoredBackend(url) {
        if (!url) return;
        // Clean up URL
        url = url.trim().replace(/\/$/, "");
        localStorage.setItem('sv_backend_url', url);
        activeBackend = url;
    }

    async function checkBackendStatus() {
        statusDot.style.background = '#fbbf24'; // Yellow
        statusText.textContent = 'Checking connectivity...';
        statusBar.style.background = 'rgba(251, 191, 36, 0.1)';

        const targetUrl = getStoredBackend();
        console.log("Checking backend:", targetUrl);

        try {
            const response = await fetch(targetUrl + '/', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(3000)
            });

            if (response.ok) {
                // Success!
                activeBackend = targetUrl;
                statusDot.style.background = '#22c55e'; // Green
                statusText.textContent = 'Live';
                statusBar.style.background = 'rgba(34, 197, 94, 0.1)';
                return;
            }
        } catch (e) {
            console.log("Backend offline:", e);
        }

        // Only try fallback if configured
        if (CONFIG.FALLBACK_BACKEND) {
            try {
                const fbRes = await fetch(CONFIG.FALLBACK_BACKEND + '/', { signal: AbortSignal.timeout(3000) });
                if (fbRes.ok) {
                    activeBackend = CONFIG.FALLBACK_BACKEND;
                    statusDot.style.background = '#3b82f6';
                    statusText.textContent = 'Live (Cloud)';
                    statusBar.style.background = 'rgba(59, 130, 246, 0.1)';
                    return; // Don't prompt if fallback works
                }
            } catch (e) { }
        }

        // If we get here, both Custom and Fallback failed
        statusDot.style.background = '#ef4444'; // Red
        statusText.textContent = 'Offline';
        statusBar.style.background = 'rgba(239, 68, 68, 0.1)';

        // Prompt user for new URL
        const newUrl = prompt("🔴 Backend Offline!\n\nPaste your new Cloudflare URL from Termux:\n(Starts with https://...trycloudflare.com)");
        if (newUrl) {
            setStoredBackend(newUrl);
            checkBackendStatus(); // Retry immediately
        }
    }

    // Check status on load
    checkBackendStatus();

    // --- Action Flow ---

    loadBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return alert("Please enter a URL");
        currentUrl = url;

        // Reset view
        container.style.display = 'none';
        video.pause();
        video.src = "";

        // Show Action Modal
        actionModal.style.display = 'block';
    });

    // Paste Button Logic
    const pasteBtn = document.getElementById('pasteBtn');
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    urlInput.value = text;
                    // Optional: Auto-focus or highlight
                    urlInput.focus();
                    // Visual feedback
                    const originalIcon = pasteBtn.innerHTML;
                    pasteBtn.innerHTML = '<i class="fas fa-check" style="color: var(--primary)"></i>';
                    setTimeout(() => pasteBtn.innerHTML = originalIcon, 1500);
                }
            } catch (err) {
                console.error('Failed to read clipboard', err);
                alert('Clipboard permission denied or not available.');
            }
        });
    }

    // Option A: Download
    downloadActionBtn.addEventListener('click', () => {
        if (!currentUrl) return;
        // Redirect to dedicated download page with URL pre-filled
        window.location.href = `download.html?url=${encodeURIComponent(currentUrl)}`;
    });

    // Option B: Watch Online
    streamActionBtn.addEventListener('click', () => {
        if (!currentUrl) return;

        // Hide modal, show player
        actionModal.style.display = 'none';
        container.style.display = 'block';

        startPlayback(currentUrl);
    });

    // --- Playback Logic ---

    function startPlayback(url) {
        spinner.classList.add('active');

        if (activeBackend) {
            // Use proxy backend
            video.src = `${activeBackend}/stream?url=${encodeURIComponent(url)}`;

            video.onerror = () => {
                console.log("Proxy failed, trying direct...");
                video.src = url;
            };
        } else {
            // Direct play (no backend available)
            video.src = url;
        }

        video.onloadeddata = () => {
            spinner.classList.remove('active');
            video.play().catch(e => console.log("Autoplay blocked", e));
        };
    }

    // --- Custom Controls ---

    // Play/Pause
    function togglePlay() {
        if (video.paused || video.ended) {
            video.play();
        } else {
            video.pause();
        }
    }

    playPauseBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    // Update Icon
    video.addEventListener('play', () => {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        isPlaying = true;
    });

    video.addEventListener('pause', () => {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        isPlaying = false;
    });

    // Progress Bar Update (Time Update)
    video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        const progressPercent = (video.currentTime / video.duration) * 100;
        seekSlider.value = progressPercent;

        currentTimeText.innerText = formatTime(video.currentTime);
        durationText.innerText = formatTime(video.duration);
    });

    // Seek (Input Change)
    seekSlider.addEventListener('input', () => {
        if (!video.duration) return;
        const seekTime = (seekSlider.value / 100) * video.duration;
        video.currentTime = seekTime;
    });

    // Volume
    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value;
    });

    // Fullscreen
    fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    // Loading Spinner Events
    video.addEventListener('waiting', () => spinner.classList.add('active'));
    video.addEventListener('playing', () => spinner.classList.remove('active'));

    // Helpers
    function formatTime(seconds) {
        if (!seconds) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
});
