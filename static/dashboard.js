// ===================== AUTH CHECK =====================
const token = localStorage.getItem('access_token');
console.log('Dashboard - Token:', token ? 'exists' : 'missing');
if (!token) {
    window.location.href = '/';
}

const username = localStorage.getItem('username') || 'Player';
console.log('Dashboard - Username:', username);

// ===================== API HELPER =====================
async function apiFetch(url, options = {}) {
    const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`,
    };
    if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    console.log('API Fetch:', url, 'Headers:', headers);
    const res = await fetch(url, { ...options, headers });
    console.log('API Response:', url, 'Status:', res.status);
    if (res.status === 401) {
        console.error('401 Unauthorized - clearing token and redirecting');
        localStorage.removeItem('access_token');
        localStorage.removeItem('username');
        window.location.href = '/';
        return null;
    }
    return res;
}

// ===================== NAVIGATION =====================
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');

        if (section === 'leaderboard') loadLeaderboard();
    });
});

// ===================== LOGOUT =====================
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('username');
    window.location.href = '/';
});

document.getElementById('play-btn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/game';
});

// ===================== LOAD DASHBOARD =====================
async function loadDashboard() {
    try {
        const res = await apiFetch('/api/dashboard/stats');
        if (!res) return;
        const data = await res.json();
        console.log('Dashboard data:', data);

    // Update sidebar
    document.getElementById('sidebar-username').textContent = data.username;
    document.getElementById('avatar-letter').textContent = data.username.charAt(0).toUpperCase();
    document.getElementById('user-avatar').style.background = `linear-gradient(135deg, ${data.avatar_color}, ${adjustColor(data.avatar_color, 40)})`;
    document.getElementById('member-since').textContent = `Since ${formatDate(data.created_at) || 'today'}`;

    // Stats
    document.getElementById('stat-high-score').textContent = data.high_score;
    document.getElementById('stat-games').textContent = data.games_played;
    document.getElementById('stat-total-score').textContent = data.total_score;
    document.getElementById('stat-avg-score').textContent = data.avg_score;
    document.getElementById('quick-high').textContent = data.high_score;

    // Best game
    if (data.best_game) {
        document.getElementById('best-score').textContent = data.best_game.score;
        document.getElementById('best-date').textContent = formatDate(data.best_game.played_at);
    }

    // History
    renderHistory(data.recent_games);

    // Settings
    loadSettings();
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

function renderHistory(games) {
    const tbody = document.getElementById('history-body');
    if (!games || games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No games played yet</td></tr>';
        return;
    }
    tbody.innerHTML = games.map((g, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong style="color:#00ff88">${g.score}</strong></td>
            <td style="color:rgba(200,220,255,0.5)">${formatDate(g.played_at)}</td>
        </tr>
    `).join('');
}

// ===================== LEADERBOARD =====================
async function loadLeaderboard() {
    const res = await apiFetch('/api/leaderboard');
    if (!res) return;
    const data = await res.json();
    const list = document.getElementById('leaderboard-list');

    if (!data.leaderboard || data.leaderboard.length === 0) {
        list.innerHTML = '<div class="empty-state">No scores yet. Be the first!</div>';
        return;
    }

    list.innerHTML = data.leaderboard.map((p, i) => {
        const topClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
        const color = p.avatar_color || '#00c8ff';
        return `
            <div class="lb-entry ${topClass}">
                <div class="lb-rank">${i + 1}</div>
                <div class="lb-avatar" style="background:${color}">${p.username.charAt(0).toUpperCase()}</div>
                <div class="lb-name">${p.username}</div>
                <div class="lb-score">${p.high_score}</div>
                <div class="lb-games">${p.games_played} games</div>
            </div>
        `;
    }).join('');
}

// ===================== SETTINGS =====================
async function loadSettings() {
    const res = await apiFetch('/api/profile');
    if (!res) return;
    const data = await res.json();

    document.getElementById('settings-username').textContent = data.username;
    document.getElementById('settings-email').textContent = data.email;
    document.getElementById('settings-joined').textContent = formatDate(data.created_at) || 'Today';
    document.getElementById('settings-last-login').textContent = formatDate(data.last_login) || 'Now';

    // Highlight current color
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(s => {
        if (s.dataset.color === data.avatar_color) s.classList.add('active');
        else s.classList.remove('active');
    });
}

// Color picker
document.getElementById('color-picker').addEventListener('click', async (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    const color = swatch.dataset.color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');

    await apiFetch('/api/profile/avatar', {
        method: 'PUT',
        body: { color },
    });

    // Update avatar immediately
    document.getElementById('user-avatar').style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, 40)})`;
});

// ===================== HELPERS =====================
function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr + 'Z');
        return d.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function adjustColor(hex, amount) {
    // Simple color adjust for gradient
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ===================== INIT =====================
loadDashboard();
