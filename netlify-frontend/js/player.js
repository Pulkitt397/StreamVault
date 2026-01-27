// StreamVault Frontend - Connects to Phone Backend via Cloudflare Tunnel
// Configure your backend URLs here

const CONFIG = {
    // Primary backend (your phone via Cloudflare tunnel)
    // UPDATE THIS with your current cloudflared URL
    PRIMARY_BACKEND: 'https://uri-stored-expand-revolutionary.trycloudflare.com',

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

    // --- Check Backend Status ---
    async function checkBackendStatus() {
        statusDot.style.background = '#fbbf24'; // Yellow - checking
        statusText.textContent = 'Checking backend...';
        statusBar.style.background = 'rgba(251, 191, 36, 0.1)';
        statusBar.style.border = '1px solid rgba(251, 191, 36, 0.3)';

        // Try primary backend first
        try {
            const response = await fetch(CONFIG.PRIMARY_BACKEND + '/', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(5000)
            });
            if (response.ok) {
                activeBackend = CONFIG.PRIMARY_BACKEND;
                statusDot.style.background = '#22c55e'; // Green
                statusText.textContent = '📱 Connected to Phone Backend';
                statusBar.style.background = 'rgba(34, 197, 94, 0.1)';
                statusBar.style.border = '1px solid rgba(34, 197, 94, 0.3)';
                return;
            }
        } catch (e) {
            console.log('Primary backend unavailable, trying fallback...');
        }

        // Try fallback backend
        try {
            const response = await fetch(CONFIG.FALLBACK_BACKEND + '/', {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(5000)
            });
            if (response.ok) {
                activeBackend = CONFIG.FALLBACK_BACKEND;
                statusDot.style.background = '#3b82f6'; // Blue
                statusText.textContent = '☁️ Connected to Cloud Backend';
                statusBar.style.background = 'rgba(59, 130, 246, 0.1)';
                statusBar.style.border = '1px solid rgba(59, 130, 246, 0.3)';
                return;
            }
        } catch (e) {
            console.log('Fallback backend also unavailable');
        }

        // Both backends down
        statusDot.style.background = '#ef4444'; // Red
        statusText.textContent = '❌ No backend available - Direct play only';
        statusBar.style.background = 'rgba(239, 68, 68, 0.1)';
        statusBar.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        activeBackend = null;
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

    // Option A: Download
    downloadActionBtn.addEventListener('click', () => {
        if (!currentUrl) return;
        if (!activeBackend) {
            alert('No backend available for download. Try direct link.');
            return;
        }
        // Trigger download via proxy with download=true param
        const downloadUrl = `${activeBackend}/stream?url=${encodeURIComponent(currentUrl)}&download=true`;
        window.location.href = downloadUrl;
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
