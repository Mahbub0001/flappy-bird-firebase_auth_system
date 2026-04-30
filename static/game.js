// ===================== AUDIO ENGINE =====================
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.bgmPlaying = false;
        this.bgmInterval = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playFlap() {
        if (this.muted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playScore() {
        if (this.muted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(523, this.ctx.currentTime);
        osc.frequency.setValueAtTime(659, this.ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(784, this.ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playHit() {
        if (this.muted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.3);
    }

    startBGM() {
        if (this.bgmPlaying || this.muted || !this.ctx) return;
        this.bgmPlaying = true;
        const notes = [261, 329, 392, 523, 392, 329, 261, 196];
        let i = 0;
        const playNote = () => {
            if (this.muted || !this.bgmPlaying) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = notes[i % notes.length];
            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.4);
            i++;
        };
        playNote();
        this.bgmInterval = setInterval(playNote, 500);
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }

    toggle() {
        this.muted = !this.muted;
        if (this.muted) this.stopBGM();
        return this.muted;
    }
}

// ===================== GAME ENGINE =====================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const W = 400;
const H = 600;
canvas.width = W;
canvas.height = H;

const audio = new AudioEngine();

// Game state
let gameState = 'start'; // start, playing, gameover
let score = 0;
let highScore = 0;
let frameCount = 0;

// Bird
const bird = {
    x: 80,
    y: H / 2,
    w: 34,
    h: 26,
    vy: 0,
    gravity: 0.45,
    flapForce: -7.5,
    rotation: 0,
    flapAnim: 0,
};

// Pipes
let pipes = [];
const pipeW = 60;
const pipeGap = 150;
const pipeSpeed = 2.5;
const pipeSpawnInterval = 100; // frames

// Particles
let particles = [];

// Stars background
let stars = [];
for (let i = 0; i < 60; i++) {
    stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.5 + 0.2,
        alpha: Math.random() * 0.5 + 0.3,
    });
}

// DOM elements
const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('score-display');
const startHighScore = document.getElementById('start-high-score');
const finalScore = document.getElementById('final-score');
const finalHighScore = document.getElementById('final-high-score');
const newRecord = document.getElementById('new-record');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const soundToggle = document.getElementById('sound-toggle');
const soundOnIcon = document.getElementById('sound-on-icon');
const soundOffIcon = document.getElementById('sound-off-icon');

// ===================== AUTH =====================
const token = localStorage.getItem('access_token');
if (!token) {
    window.location.href = '/';
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

// ===================== API =====================
async function fetchHighScore() {
    try {
        const res = await fetch('/api/high-score', { headers: authHeaders() });
        if (res.status === 401) { window.location.href = '/'; return; }
        const data = await res.json();
        highScore = data.high_score;
        startHighScore.textContent = highScore;
    } catch (e) {
        console.warn('Could not fetch high score', e);
    }
}

async function saveHighScore(s) {
    try {
        const res = await fetch('/api/game-result', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ score: s }),
        });
        if (res.status === 401) { window.location.href = '/'; return false; }
        const data = await res.json();
        highScore = data.high_score;
        return data.new_record;
    } catch (e) {
        console.warn('Could not save high score', e);
        return false;
    }
}

// ===================== DRAWING =====================
function drawBackground() {
    // Gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(0.5, '#1a1a4e');
    grad.addColorStop(1, '#0d0d3d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    stars.forEach(s => {
        s.x -= s.speed;
        if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${s.alpha})`;
        ctx.fill();
    });

    // Ground
    const groundGrad = ctx.createLinearGradient(0, H - 60, 0, H);
    groundGrad.addColorStop(0, '#1a3a2a');
    groundGrad.addColorStop(1, '#0d2a1a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, H - 60, W, 60);

    // Ground line
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 60);
    ctx.lineTo(W, H - 60);
    ctx.stroke();

    // Ground detail lines
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 20) {
        const offset = (frameCount * 2 + i) % (W + 40) - 20;
        ctx.beginPath();
        ctx.moveTo(offset, H - 50);
        ctx.lineTo(offset - 10, H - 30);
        ctx.stroke();
    }
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);

    // Rotation based on velocity
    bird.rotation = Math.min(Math.max(bird.vy * 3, -30), 70);
    ctx.rotate(bird.rotation * Math.PI / 180);

    // Glow
    ctx.shadowColor = '#00c8ff';
    ctx.shadowBlur = 15;

    // Body
    const bodyGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    bodyGrad.addColorStop(0, '#00e5ff');
    bodyGrad.addColorStop(1, '#0088cc');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.w / 2, bird.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.shadowBlur = 0;
    bird.flapAnim += 0.3;
    const wingY = Math.sin(bird.flapAnim) * 5;
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.ellipse(-5, wingY, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a2e';
    ctx.beginPath();
    ctx.arc(9.5, -5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawPipe(pipe) {
    const capH = 26;
    const capExtra = 8;

    // Top pipe
    const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeW, 0);
    topGrad.addColorStop(0, '#004433');
    topGrad.addColorStop(0.5, '#008855');
    topGrad.addColorStop(1, '#004433');

    ctx.fillStyle = topGrad;
    ctx.fillRect(pipe.x, 0, pipeW, pipe.topH);

    // Top cap
    ctx.fillStyle = '#00cc77';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillRect(pipe.x - capExtra, pipe.topH - capH, pipeW + capExtra * 2, capH);
    ctx.shadowBlur = 0;

    // Neon border top pipe
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pipe.x - capExtra, pipe.topH - capH, pipeW + capExtra * 2, capH);

    // Bottom pipe
    const botY = pipe.topH + pipeGap;
    ctx.fillStyle = topGrad;
    ctx.fillRect(pipe.x, botY, pipeW, H - botY - 60);

    // Bottom cap
    ctx.fillStyle = '#00cc77';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillRect(pipe.x - capExtra, botY, pipeW + capExtra * 2, capH);
    ctx.shadowBlur = 0;

    // Neon border bottom pipe
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pipe.x - capExtra, botY, pipeW + capExtra * 2, capH);
}

function drawParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) {
            particles.splice(i, 1);
            return;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
        ctx.fill();
    });
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            r: Math.random() * 3 + 1,
            life: 1,
            color: color,
        });
    }
}

// ===================== GAME LOGIC =====================
function resetGame() {
    bird.y = H / 2;
    bird.vy = 0;
    bird.rotation = 0;
    bird.flapAnim = 0;
    pipes = [];
    particles = [];
    score = 0;
    frameCount = 0;
    scoreDisplay.textContent = '0';
}

function flap() {
    if (gameState !== 'playing') return;
    bird.vy = bird.flapForce;
    bird.flapAnim = 0;
    audio.playFlap();
    spawnParticles(bird.x - 10, bird.y + 5, '0, 200, 255', 3);
}

function spawnPipe() {
    const minTop = 60;
    const maxTop = H - pipeGap - 60 - 60; // ground height 60
    const topH = Math.random() * (maxTop - minTop) + minTop;
    pipes.push({
        x: W + 10,
        topH: topH,
        scored: false,
    });
}

function checkCollision() {
    // Ground / ceiling
    if (bird.y + bird.h / 2 > H - 60 || bird.y - bird.h / 2 < 0) {
        return true;
    }

    // Pipes
    const birdLeft = bird.x - bird.w / 2 + 4;
    const birdRight = bird.x + bird.w / 2 - 4;
    const birdTop = bird.y - bird.h / 2 + 4;
    const birdBot = bird.y + bird.h / 2 - 4;

    for (const pipe of pipes) {
        const pipeLeft = pipe.x - 8; // cap extra
        const pipeRight = pipe.x + pipeW + 8;

        if (birdRight > pipeLeft && birdLeft < pipeRight) {
            // Top pipe
            if (birdTop < pipe.topH) return true;
            // Bottom pipe
            if (birdBot > pipe.topH + pipeGap) return true;
        }
    }
    return false;
}

function gameOver() {
    gameState = 'gameover';
    audio.playHit();
    audio.stopBGM();
    spawnParticles(bird.x, bird.y, '255, 68, 102', 20);

    finalScore.textContent = score;

    saveHighScore(score).then(isRecord => {
        finalHighScore.textContent = highScore;
        if (isRecord) {
            newRecord.classList.remove('hidden');
        } else {
            newRecord.classList.add('hidden');
        }
        gameoverScreen.classList.remove('hidden');
        hud.classList.add('hidden');
    });
}

// ===================== GAME LOOP =====================
function update() {
    if (gameState !== 'playing') return;

    frameCount++;

    // Bird physics
    bird.vy += bird.gravity;
    bird.y += bird.vy;

    // Pipe spawning
    if (frameCount % pipeSpawnInterval === 0) {
        spawnPipe();
    }

    // Move pipes
    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed;

        // Score
        if (!pipe.scored && pipe.x + pipeW < bird.x) {
            pipe.scored = true;
            score++;
            scoreDisplay.textContent = score;
            audio.playScore();
            spawnParticles(bird.x, bird.y - 20, '0, 255, 136', 8);
        }
    });

    // Remove off-screen pipes
    pipes = pipes.filter(p => p.x + pipeW + 10 > 0);

    // Collision
    if (checkCollision()) {
        gameOver();
    }
}

function draw() {
    drawBackground();
    pipes.forEach(drawPipe);
    drawBird();
    drawParticles();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ===================== INPUT =====================
function handleInput() {
    audio.init();
    if (gameState === 'playing') {
        flap();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleInput();
    }
});

canvas.addEventListener('click', handleInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
});

startBtn.addEventListener('click', () => {
    audio.init();
    resetGame();
    gameState = 'playing';
    startScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    audio.startBGM();
});

restartBtn.addEventListener('click', () => {
    resetGame();
    gameState = 'playing';
    gameoverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    audio.startBGM();
});

soundToggle.addEventListener('click', () => {
    audio.init();
    const muted = audio.toggle();
    if (muted) {
        soundOnIcon.classList.add('hidden');
        soundOffIcon.classList.remove('hidden');
    } else {
        soundOnIcon.classList.remove('hidden');
        soundOffIcon.classList.add('hidden');
        if (gameState === 'playing') audio.startBGM();
    }
});

// ===================== INIT =====================
fetchHighScore();
gameLoop();
