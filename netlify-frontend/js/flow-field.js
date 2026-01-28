/**
 * Flow Field Background
 * A beautiful particle flow-field animation with mouse interaction
 * Ported from React component by Easemize (21st.dev)
 */

class FlowFieldBackground {
    constructor(options = {}) {
        this.color = options.color || '#6366f1';
        this.trailOpacity = options.trailOpacity || 0.15;
        this.particleCount = options.particleCount || 600;
        this.speed = options.speed || 1;
        this.containerId = options.containerId || 'flow-field-container';

        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.particles = [];
        this.animationFrameId = null;
        this.mouse = { x: -1000, y: -1000 };

        this.init();
    }

    init() {
        // Create container and canvas if they don't exist
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = this.containerId;
            document.body.insertBefore(this.container, document.body.firstChild);
        }

        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) return;

        this.setupCanvas();
        this.createParticles();
        this.addEventListeners();
        this.animate();
    }

    setupCanvas() {
        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;

        // Handle High-DPI screens (Retina)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new Particle(this));
        }
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
        this.container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.container.addEventListener('mouseleave', () => this.handleMouseLeave());
        // Touch support
        this.container.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.container.addEventListener('touchend', () => this.handleMouseLeave());
    }

    handleResize() {
        this.setupCanvas();
        this.createParticles();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
    }

    handleTouchMove(e) {
        if (e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.touches[0].clientX - rect.left;
            this.mouse.y = e.touches[0].clientY - rect.top;
        }
    }

    handleMouseLeave() {
        this.mouse.x = -1000;
        this.mouse.y = -1000;
    }

    animate() {
        // "Fade" effect: draw semi-transparent rect for trail effect
        this.ctx.fillStyle = `rgba(2, 6, 23, ${this.trailOpacity})`;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.particles.forEach((p) => {
            p.update();
            p.draw();
        });

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.canvas && this.container) {
            this.container.removeChild(this.canvas);
        }
    }
}

class Particle {
    constructor(field) {
        this.field = field;
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * this.field.width;
        this.y = Math.random() * this.field.height;
        this.vx = 0;
        this.vy = 0;
        this.age = initial ? Math.random() * 200 : 0;
        this.life = Math.random() * 200 + 100;
    }

    update() {
        const { speed, mouse, width, height } = this.field;

        // 1. Flow Field Math (creates organic flowing patterns)
        const angle = (Math.cos(this.x * 0.005) + Math.sin(this.y * 0.005)) * Math.PI;

        // 2. Add force from flow field
        this.vx += Math.cos(angle) * 0.2 * speed;
        this.vy += Math.sin(angle) * 0.2 * speed;

        // 3. Mouse Repulsion
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const interactionRadius = 150;

        if (distance < interactionRadius) {
            const force = (interactionRadius - distance) / interactionRadius;
            this.vx -= dx * force * 0.05;
            this.vy -= dy * force * 0.05;
        }

        // 4. Apply Velocity & Friction
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;

        // 5. Aging
        this.age++;
        if (this.age > this.life) {
            this.reset();
        }

        // 6. Wrap around screen
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    draw() {
        const { ctx, color } = this.field;
        ctx.fillStyle = color;
        // Fade in and out based on age
        const alpha = 1 - Math.abs((this.age / this.life) - 0.5) * 2;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillRect(this.x, this.y, 1.5, 1.5);
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new FlowFieldBackground({
        color: '#6366f1',
        trailOpacity: 0.12,
        particleCount: 600,
        speed: 1
    });
});
