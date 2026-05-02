# Flappy Bird - GitHub Pages Deployment Guide

This guide covers deploying your Flappy Bird SPA with Firebase Google Sign-In to GitHub Pages while preserving auth functionality.

## Architecture

- **Frontend**: Hosted on GitHub Pages (static files)
- **Backend**: Remains hosted separately (FastAPI server or other host)
- **Firebase**: Client config injected at build time via GitHub Secrets
- **Auth Flow**: Popup sign-in → token exchange with backend → session management

## Prerequisites

1. **Repository**: Push to GitHub with main/master branch
2. **Firebase Project**: `flappy-bird-f246c` already configured
3. **GitHub Pages**: Enabled in repo Settings → Pages
4. **Service Account**: `credentials.json` kept server-side only (not in repo)

## Step-by-Step Deployment

### 1. Remove Credentials from Repo (CRITICAL)

```bash
# If credentials.json is in git history, remove it:
git rm --cached credentials.json
git commit -m "Remove credentials.json from version control"
git push origin main

# .gitignore now prevents accidental commits
```

### 2. Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and create these repository secrets:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `FIREBASE_API_KEY` | From Firebase Console → Project Settings | Firebase Client Config |
| `FIREBASE_AUTH_DOMAIN` | `flappy-bird-f246c.firebaseapp.com` | Firebase Client Config |
| `FIREBASE_PROJECT_ID` | `flappy-bird-f246c` | Firebase Client Config |
| `FIREBASE_DATABASE_URL` | (if using Realtime DB) | Firebase Client Config |
| `FIREBASE_STORAGE_BUCKET` | (if using Storage) | Firebase Client Config |
| `FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console | Firebase Client Config |
| `FIREBASE_APP_ID` | From Firebase Console | Firebase Client Config |
| `FIREBASE_MEASUREMENT_ID` | (optional, for Analytics) | Firebase Client Config |
| `API_BASE` | `https://your-backend-host.com` | Your backend URL |

**Note**: Find these values in Firebase Console → Project Settings → General → Copy client config

### 3. Configure Firebase Authorized Domains

1. Go to **Firebase Console → Authentication → Settings → Authorized domains**
2. Add:
   - `username.github.io` (your GitHub Pages domain)
   - Your backend domain (if making cross-origin requests from frontend)
3. Save

**Why**: Firebase blocks sign-in from unknown domains as a security measure.

### 4. Set Up Backend CORS

Update your FastAPI backend to allow GitHub Pages origin:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://username.github.io",  # Your GitHub Pages URL
        "http://localhost:8001",       # Local testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Ensure `/api/firebase-auth`, `/api/login`, `/api/register` endpoints accept POST from GitHub Pages origin.

### 5. Push Changes to Trigger Deploy

```bash
git add -A
git commit -m "Add GitHub Actions deployment workflow and auth improvements"
git push origin main
```

This triggers `.github/workflows/deploy-gh-pages.yml`:
- Reads GitHub Secrets
- Creates `static/firebase-config.json` with client config + `apiBase`
- Deploys to `gh-pages` branch
- GitHub Pages serves the site from https://username.github.io/repo-name (or custom domain)

### 6. Verify Deployment

**Check Workflow**:
1. Go to repo → **Actions** tab
2. Watch the "Deploy Frontend to GitHub Pages" workflow run
3. Confirm success (green checkmark)

**Test Sign-In**:
1. Visit https://username.github.io/repo-name
2. Click Google Sign-In button
3. Verify popup opens and sign-in works
4. Confirm redirect to `/dashboard` after token exchange
5. Refresh page — should stay logged in (localStorage persistence)

### 7. Enable GitHub Pages (if not already)

1. Go to repo → **Settings → Pages**
2. Source: Deploy from a branch
3. Branch: `gh-pages` / `root`
4. Click Save
5. Wait 1–2 minutes for site to be live

---

## Local Testing Before Deploy

### Test Locally with Backend

```bash
# Terminal 1: Start backend
cd /path/to/flappy-bird
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2: Serve static files
cd /path/to/flappy-bird
python -m http.server 8001 --directory .
```

### Update Local Config

Edit or create `static/firebase-config.json`:

```json
{
  "enabled": true,
  "apiKey": "your-firebase-api-key",
  "authDomain": "flappy-bird-f246c.firebaseapp.com",
  "projectId": "flappy-bird-f246c",
  "databaseURL": "https://flappy-bird-f246c.firebaseio.com",
  "storageBucket": "flappy-bird-f246c.appspot.com",
  "messagingSenderId": "your-sender-id",
  "appId": "your-app-id",
  "measurementId": "your-measurement-id",
  "apiBase": "http://localhost:8000"
}
```

### Add Localhost to Firebase Authorized Domains

1. Firebase Console → Authentication → Authorized domains
2. Add:
   - `localhost`
   - `127.0.0.1`

### Test Sign-In Locally

```
Browser: http://localhost:8001/
Click Google Sign-In → popup opens → select account → redirect to dashboard
Refresh page → should remain logged in
```

---

## Troubleshooting

### "Firebase not initialized" or Google button hidden

**Cause**: `firebase-config.json` not loaded or API key missing.

**Fix**:
- Check browser console for 404 errors
- Confirm `static/firebase-config.json` exists on GitHub Pages
- Verify GitHub Secrets are set correctly
- Check Actions workflow log for errors

### "Cross-Origin Request Blocked" (CORS error)

**Cause**: Backend doesn't allow GitHub Pages origin.

**Fix**:
- Add GitHub Pages URL to backend CORS allowlist
- Test locally: update `apiBase` in config to point to backend
- Restart backend after CORS changes

### "Auth/unauthorized-domain" (Firebase error)

**Cause**: GitHub Pages URL not in Firebase Authorized Domains.

**Fix**:
- Go to Firebase Console → Authentication → Authorized domains
- Add your GitHub Pages URL: `username.github.io`
- Wait 5 minutes for propagation

### "Sign-in successful but redirect doesn't work"

**Cause**: `apiBase` not set in config or backend endpoint missing.

**Fix**:
- Check `static/firebase-config.json` has `"apiBase": "https://your-backend"`
- Verify backend `/api/firebase-auth` endpoint exists and returns `access_token` + `username`
- Check backend logs for token verification errors

---

## Code Changes Summary

### `static/auth.js` Updates

1. **Firebase config loading**: Tries `firebase-config.json` first, falls back to `/api/firebase-config`
2. **Persistence**: Sets `localStorage` persistence so session survives page reloads
3. **API_BASE**: Uses `firebaseConfig.apiBase` to construct backend URLs
4. **Redirect handling**: Optional redirect result handler for future redirect flow

### `.gitignore`

- Excludes `credentials.json` (service account) from version control
- Excludes `.env` files, `__pycache__`, etc.

### `.github/workflows/deploy-gh-pages.yml`

- Triggers on push to `main`/`master`
- Creates `static/firebase-config.json` from GitHub Secrets
- Deploys to `gh-pages` branch via GitHub Pages

---

## Next Steps (Optional)

### Custom Domain

1. Add DNS records pointing to GitHub Pages
2. Add custom domain in repo → Settings → Pages
3. Update `FIREBASE_AUTH_DOMAIN` Authorized Domains to include custom domain

### Backend Deployment

If deploying backend:
- Store `credentials.json` as a GitHub Secret
- Use environment variable in backend (e.g., `FIREBASE_CREDENTIALS_JSON`)
- Deploy backend to Render, Railway, Cloud Run, etc.
- Update `API_BASE` secret to point to deployed backend

### Redirect Flow (Advanced)

To use Google Sign-In redirect flow instead of popup:

```javascript
// In auth.js, replace signInWithPopup with signInWithRedirect
await firebase.auth().signInWithRedirect(firebaseAuthProvider);
// Redirect result is handled automatically on page load
```

---

## Security Checklist

- [ ] `credentials.json` not in git history
- [ ] `.gitignore` includes `credentials.json`
- [ ] GitHub Secrets set for all Firebase config values
- [ ] Backend CORS allows GitHub Pages origin only (not `*`)
- [ ] Backend validates Firebase id tokens with Admin SDK
- [ ] `apiBase` points to production backend (not localhost)
- [ ] Firebase Authorized Domains include GitHub Pages URL
- [ ] GitHub Pages repo is private (if desired)

---

## Support

For issues:
1. Check browser DevTools Console for errors
2. Check GitHub Actions workflow logs for build/deploy errors
3. Check backend logs for token exchange errors
4. Verify all GitHub Secrets are set correctly
5. Confirm Firebase Authorized Domains and backend CORS match deployment URL
