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

    let isPlaying = false;
    let currentUrl = "";

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
        // Trigger download via proxy with download=true param
        const downloadUrl = `/stream?url=${encodeURIComponent(currentUrl)}&download=true`;
        window.location.href = downloadUrl;
    });

    // Option B: Watch Online
    streamActionBtn.addEventListener('click', () => {
        if (!currentUrl) return;

        // Hide modal, show player
        actionModal.style.display = 'none';
        container.style.display = 'block'; // Make sure your CSS allows this (flex/block)

        startPlayback(currentUrl);
    });

    // --- Playback Logic ---

    function startPlayback(url) {
        spinner.classList.add('active');

        // Strategy: Try Direct First (No Server Cost), Fallback to Proxy
        video.src = url;

        video.onerror = () => {
            console.log("Direct play failed/blocked. Switching to StreamVault Proxy...");
            video.src = `/stream?url=${encodeURIComponent(url)}`;
        };

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
