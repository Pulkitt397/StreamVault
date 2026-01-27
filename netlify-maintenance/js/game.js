
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('gameOverlay');
const highScoreEl = document.getElementById('highScore');

// Game State
let frames = 0;
let score = 0;
let highScore = localStorage.getItem('sv_flappy_highscore') || 0;
let isPlaying = false;
let isGameOver = false;
let animationId;

highScoreEl.innerText = highScore;

// Game Variables
const gravity = 0.25;
const jump = 4.5;
const speed = 2;
const pipeGap = 130;
const pipeFrequency = 120; // Frames

// Assets
const bird = {
    x: 50,
    y: 150,
    w: 25,
    h: 25,
    radius: 12,
    velocity: 0,
    draw: function () {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x + 6, this.y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + 8, this.y - 4, 2, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(this.x + 8, this.y + 2);
        ctx.lineTo(this.x + 16, this.y + 6);
        ctx.lineTo(this.x + 8, this.y + 10);
        ctx.fill();
    },
    update: function () {
        this.velocity += gravity;
        this.y += this.velocity;

        // Floor Collision
        if (this.y + this.radius >= canvas.height) {
            this.y = canvas.height - this.radius;
            gameOver();
        }
    },
    flap: function () {
        this.velocity = -jump;
    }
};

const pipes = {
    positions: [],
    draw: function () {
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;

        for (let i = 0; i < this.positions.length; i++) {
            const p = this.positions[i];
            const topY = p.y;
            const bottomY = p.y + pipeGap;

            // Top Pipe
            ctx.fillRect(p.x, 0, p.w, topY);
            ctx.strokeRect(p.x, 0, p.w, topY);

            // Bottom Pipe
            ctx.fillRect(p.x, bottomY, p.w, canvas.height - bottomY);
            ctx.strokeRect(p.x, bottomY, p.w, canvas.height - bottomY);

            // Cap visual
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(p.x - 2, topY - 20, p.w + 4, 20); // Top cap
            ctx.fillRect(p.x - 2, bottomY, p.w + 4, 20); // Bottom cap
            ctx.fillStyle = '#22c55e'; // reset
        }
    },
    update: function () {
        // Add new pipe
        if (frames % pipeFrequency === 0) {
            this.positions.push({
                x: canvas.width,
                y: Math.random() * (canvas.height - pipeGap - 100) + 50,
                w: 50,
                passed: false
            });
        }

        for (let i = 0; i < this.positions.length; i++) {
            const p = this.positions[i];
            p.x -= speed;

            // Collision Detection
            // Horizontal
            if (bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + p.w) {
                // Vertical (Top pipe or Bottom pipe)
                if (bird.y - bird.radius < p.y || bird.y + bird.radius > p.y + pipeGap) {
                    gameOver();
                }
            }

            // Score Update
            if (p.x + p.w < bird.x && !p.passed) {
                score++;
                p.passed = true;
                // Speed up slightly every 5 points
                if (score % 5 === 0) frames += 10;
            }

            // Remove off-screen pipes
            if (p.x + p.w < 0) {
                this.positions.shift();
                i--;
            }
        }
    }
};

function drawScore() {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.lineWidth = 1;
    ctx.fillText(score, canvas.width / 2 - 10, 50);
    ctx.strokeText(score, canvas.width / 2 - 10, 50);
}

function loop() {
    if (!isPlaying) return;

    // Clear
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw/Update
    pipes.update();
    pipes.draw();

    bird.update();
    bird.draw();

    drawScore();

    frames++;
    animationId = requestAnimationFrame(loop);
}

function resetGame() {
    bird.y = 150;
    bird.velocity = 0;
    pipes.positions = [];
    score = 0;
    frames = 0;
    isGameOver = false;
}

function startGame() {
    if (isPlaying) return;
    resetGame();
    isPlaying = true;
    overlay.style.display = 'none';
    loop();
}

function gameOver() {
    isPlaying = false;
    isGameOver = true;
    cancelAnimationFrame(animationId);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('sv_flappy_highscore', highScore);
        highScoreEl.innerText = highScore;
    }

    overlay.style.display = 'flex';
    overlay.querySelector('h2').innerText = "Game Over";
    overlay.querySelector('p').innerText = `Score: ${score}`;
    overlay.querySelector('button').innerText = "Try Again";
}

// Input Handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!isPlaying && !isGameOver) startGame();
        else if (isGameOver) startGame();
        else bird.flap();
    }
});

canvas.addEventListener('click', () => {
    if (isPlaying) bird.flap();
});

overlay.addEventListener('click', () => {
    startGame();
});

// Initial Render
ctx.fillStyle = '#334155';
ctx.fillRect(0, 0, canvas.width, canvas.height);
bird.draw();
