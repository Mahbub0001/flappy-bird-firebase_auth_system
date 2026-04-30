// ===================== FIREBASE INIT =====================
let firebaseApp = null;
let firebaseAuthProvider = null;

async function initFirebase() {
    try {
        const res = await fetch('/api/firebase-config');
        const config = await res.json();
        if (!config.enabled) {
            console.warn('Firebase not configured - hiding Google buttons');
            document.querySelectorAll('.google-btn').forEach(btn => btn.style.display = 'none');
            document.querySelectorAll('.divider').forEach(d => d.style.display = 'none');
            return;
        }
        if (!config.apiKey) {
            console.warn('Firebase API key not set - hiding Google buttons');
            document.querySelectorAll('.google-btn').forEach(btn => btn.style.display = 'none');
            document.querySelectorAll('.divider').forEach(d => d.style.display = 'none');
            return;
        }
        firebaseApp = firebase.initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            databaseURL: config.databaseURL,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
            measurementId: config.measurementId,
        });
        firebaseAuthProvider = new firebase.auth.GoogleAuthProvider();
        firebaseAuthProvider.setCustomParameters({ prompt: 'select_account' });
        console.log('Firebase initialized');
    } catch (err) {
        console.error('Firebase init error:', err);
        document.querySelectorAll('.google-btn').forEach(btn => btn.style.display = 'none');
        document.querySelectorAll('.divider').forEach(d => d.style.display = 'none');
    }
}
initFirebase();

// ===================== GOOGLE SIGN-IN =====================
async function handleGoogleSignIn(errorEl) {
    if (!firebaseApp || !firebaseAuthProvider) {
        showError(errorEl, 'Google Sign-In is not available');
        return;
    }
    errorEl.classList.add('hidden');
    try {
        const result = await firebase.auth().signInWithPopup(firebaseAuthProvider);
        const idToken = await result.user.getIdToken();
        console.log('Google Sign-In success, sending token to server...');

        const res = await fetch('/api/firebase-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken }),
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { detail: text }; }

        if (!res.ok) {
            showError(errorEl, data.detail || 'Google Sign-In failed');
            return;
        }
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('username', data.username);
        window.location.href = '/dashboard';
    } catch (err) {
        console.error('Google Sign-In error:', err);
        if (err.code === 'auth/popup-closed-by-user') return;
        showError(errorEl, err.message || 'Google Sign-In failed');
    }
}

// ===================== BACKGROUND ANIMATION =====================
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

function resizeBg() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}
resizeBg();
window.addEventListener('resize', resizeBg);

const bgParticles = [];
for (let i = 0; i < 80; i++) {
    bgParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        alpha: Math.random() * 0.5 + 0.1,
    });
}

function animateBg() {
    bgCtx.fillStyle = '#0a0a1a';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    bgParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = bgCanvas.width;
        if (p.x > bgCanvas.width) p.x = 0;
        if (p.y < 0) p.y = bgCanvas.height;
        if (p.y > bgCanvas.height) p.y = 0;

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(0, 200, 255, ${p.alpha})`;
        bgCtx.fill();
    });

    // Draw connections
    bgParticles.forEach((a, i) => {
        bgParticles.slice(i + 1).forEach(b => {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                bgCtx.beginPath();
                bgCtx.moveTo(a.x, a.y);
                bgCtx.lineTo(b.x, b.y);
                bgCtx.strokeStyle = `rgba(0, 200, 255, ${0.05 * (1 - dist / 120)})`;
                bgCtx.stroke();
            }
        });
    });

    requestAnimationFrame(animateBg);
}
animateBg();

// ===================== AUTH LOGIC =====================
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const regError = document.getElementById('reg-error');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabIndicator = document.getElementById('tab-indicator');
const loginFooter = document.getElementById('login-footer');
const registerFooter = document.getElementById('register-footer');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');

// Check if already logged in
const token = localStorage.getItem('access_token');
if (token) {
    window.location.href = '/dashboard';
}

// Tab switching
function switchTab(tab) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (tab === 'register') {
        tabIndicator.classList.add('right');
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        loginFooter.classList.add('hidden');
        registerFooter.classList.remove('hidden');
    } else {
        tabIndicator.classList.remove('right');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginFooter.classList.remove('hidden');
        registerFooter.classList.add('hidden');
    }
    // Clear errors
    loginError.classList.add('hidden');
    regError.classList.add('hidden');
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

showRegister.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
showLogin.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });

// Google Sign-In button listeners
document.getElementById('google-login-btn').addEventListener('click', () => {
    handleGoogleSignIn(loginError);
});
document.getElementById('google-register-btn').addEventListener('click', () => {
    handleGoogleSignIn(regError);
});

// Show error
function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
}

// Set loading state
function setLoading(btn, loading) {
    if (loading) {
        btn.disabled = true;
        btn._origText = btn.textContent;
        btn.innerHTML = '<span class="spinner"></span>';
    } else {
        btn.disabled = false;
        btn.textContent = btn._origText;
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('.submit-btn');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    loginError.classList.add('hidden');
    setLoading(btn, true);

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            showError(loginError, data.detail || 'Login failed');
            setLoading(btn, false);
            return;
        }
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('username', data.username);
        window.location.href = '/dashboard';
    } catch (err) {
        showError(loginError, 'Network error. Please try again.');
        setLoading(btn, false);
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('.submit-btn');
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    regError.classList.add('hidden');

    if (password !== confirm) {
        showError(regError, 'Passwords do not match');
        return;
    }

    setLoading(btn, true);

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const text = await res.text();
        console.log('Response status:', res.status);
        console.log('Response text:', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { detail: text || 'Server error' };
        }

        if (!res.ok) {
            showError(regError, data.detail || 'Registration failed');
            setLoading(btn, false);
            return;
        }
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('username', data.username);
        window.location.href = '/dashboard';
    } catch (err) {
        console.error('Register error:', err);
        showError(regError, `Error: ${err.message || 'Network error'}`);
        setLoading(btn, false);
    }
});
