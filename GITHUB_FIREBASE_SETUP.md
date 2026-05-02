# GitHub & Firebase Setup - Manual Steps

This document provides exact copy-paste instructions for the remaining manual setup steps.

---

## Step 1: Get Your Firebase Config Values

### Where to Find Them

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **`flappy-bird-f246c`**
3. Click **⚙️ Project Settings** (gear icon, top-left)
4. Go to **General** tab
5. Scroll to **"Your apps"** section
6. Find your **Web** app (should show `flappy-bird-f246c.firebaseapp.com`)
7. Click the config icon (looks like `</>`), then **Copy**

You'll get a config JSON like:

```json
{
  "apiKey": "AIza...",
  "authDomain": "flappy-bird-f246c.firebaseapp.com",
  "projectId": "flappy-bird-f246c",
  "storageBucket": "flappy-bird-f246c.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc123...",
  "measurementId": "G-ABC123"
}
```

**Save these values** — you'll need them for GitHub Secrets.

---

## Step 2: Add GitHub Repository Secrets

### Access GitHub Secrets

1. Go to your GitHub repository: `https://github.com/YOUR-USERNAME/flappy-bird`
2. Click **Settings** (tab at top)
3. Left sidebar → **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Add Each Secret (one at a time)

**Secret 1: FIREBASE_API_KEY**
- Name: `FIREBASE_API_KEY`
- Value: (paste your `apiKey` from Firebase config)
- Click **Add secret**

**Secret 2: FIREBASE_AUTH_DOMAIN**
- Name: `FIREBASE_AUTH_DOMAIN`
- Value: `flappy-bird-f246c.firebaseapp.com`
- Click **Add secret**

**Secret 3: FIREBASE_PROJECT_ID**
- Name: `FIREBASE_PROJECT_ID`
- Value: `flappy-bird-f246c`
- Click **Add secret**

**Secret 4: FIREBASE_DATABASE_URL** (optional, if using Realtime DB)
- Name: `FIREBASE_DATABASE_URL`
- Value: `https://flappy-bird-f246c.firebaseio.com`
- Click **Add secret**

**Secret 5: FIREBASE_STORAGE_BUCKET** (optional, if using Storage)
- Name: `FIREBASE_STORAGE_BUCKET`
- Value: `flappy-bird-f246c.appspot.com`
- Click **Add secret**

**Secret 6: FIREBASE_MESSAGING_SENDER_ID**
- Name: `FIREBASE_MESSAGING_SENDER_ID`
- Value: (paste your `messagingSenderId` from Firebase config)
- Click **Add secret**

**Secret 7: FIREBASE_APP_ID**
- Name: `FIREBASE_APP_ID`
- Value: (paste your `appId` from Firebase config)
- Click **Add secret**

**Secret 8: FIREBASE_MEASUREMENT_ID** (optional, for Analytics)
- Name: `FIREBASE_MEASUREMENT_ID`
- Value: (paste your `measurementId` from Firebase config, or leave empty)
- Click **Add secret**

**Secret 9: API_BASE** (IMPORTANT)
- Name: `API_BASE`
- Value: `https://your-backend-domain.com` (e.g., `https://api.example.com`)
  - For production: full domain
  - For testing: can be empty string `""` or local URL like `http://localhost:8000`
- Click **Add secret**

### Verify Secrets Added

Go back to **Settings → Secrets and variables → Actions** — you should see all 9 secrets listed.

---

## Step 3: Configure Firebase Authorized Domains

### Add Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com/) → **`flappy-bird-f246c`** project
2. Left sidebar → **Authentication** → **Settings** tab
3. Scroll to **Authorized domains** section
4. Click **Add domain**

### Add Each Domain

**Domain 1: GitHub Pages**
- Enter: `YOUR-USERNAME.github.io` (replace `YOUR-USERNAME` with your GitHub username)
- Click **Add**

**Domain 2: Backend Domain** (if applicable)
- If deploying backend to a separate host, add that domain
- E.g., `api.example.com`, `backend.herokuapp.com`
- Click **Add**

**Domain 3: Localhost** (for local testing)
- Enter: `localhost`
- Click **Add**
- Enter: `127.0.0.1`
- Click **Add**

### Verify

You should see a list like:
- `flappy-bird-f246c.firebaseapp.com` (default)
- `YOUR-USERNAME.github.io`
- `your-backend-domain.com` (if applicable)
- `localhost`
- `127.0.0.1`

---

## Step 4: Update Backend CORS Settings

### Edit `main.py` (FastAPI Backend)

Add or update CORS middleware to allow your GitHub Pages origin and backend domain:

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI()

# Add this middleware BEFORE your route definitions
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://YOUR-USERNAME.github.io",  # Replace with your GitHub Pages URL
        "http://localhost:8001",             # Local testing (frontend on port 8001)
        "http://localhost:3000",             # Alternative local port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... rest of your routes
```

### Restart Backend

```bash
# Stop current server (Ctrl+C in terminal running uvicorn)
# Then restart:
uvicorn main:app --reload
```

---

## Step 5: Test Locally Before Deploying

### Terminal 1: Start Backend

```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Wait for output: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 2: Setup Local Config

```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
.\setup-local-config.ps1
```

Edit `static/firebase-config.json` and replace placeholders with your actual Firebase config values:

```json
{
  "enabled": true,
  "apiKey": "YOUR_ACTUAL_FIREBASE_API_KEY",
  "authDomain": "flappy-bird-f246c.firebaseapp.com",
  "projectId": "flappy-bird-f246c",
  "databaseURL": "https://flappy-bird-f246c.firebaseio.com",
  "storageBucket": "flappy-bird-f246c.appspot.com",
  "messagingSenderId": "YOUR_ACTUAL_SENDER_ID",
  "appId": "YOUR_ACTUAL_APP_ID",
  "measurementId": "YOUR_ACTUAL_MEASUREMENT_ID",
  "apiBase": "http://localhost:8000"
}
```

### Terminal 3: Serve Frontend Locally

```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
python -m http.server 8001 --directory .
```

Wait for output about serving on port 8001.

### Test Sign-In

1. Open browser: `http://localhost:8001`
2. You should see the login/register page
3. Click **Google Sign-In** button (or login normally)
4. If Google button works:
   - Popup opens
   - Select account
   - Gets redirected to dashboard
   - LocalStorage shows `access_token` and `username`
5. Refresh page — should still be logged in (persistence works)

### Troubleshooting Local Test

| Issue | Fix |
|-------|-----|
| Google button hidden | Check browser console; Firebase config has `enabled: false` or missing `apiKey` |
| "Cross-origin blocked" error | Backend CORS not configured; add `http://localhost:8001` to `allow_origins` |
| "Unauthorized domain" error | Add `localhost` to Firebase Console → Authorized domains |
| Can't POST to backend | Check `apiBase` in config points to `http://localhost:8000` (matches backend port) |

---

## Step 6: Deploy to GitHub Pages

### Push to Main (Triggers Workflow)

```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
git add -A
git commit -m "Ready for GitHub Pages deployment"
git push origin main
```

### Monitor Deployment

1. Go to: `https://github.com/YOUR-USERNAME/flappy-bird`
2. Click **Actions** tab
3. Watch workflow: **Deploy Frontend to GitHub Pages**
4. Wait for ✅ green checkmark (usually 1–2 minutes)

### Check Deployed Site

1. Go to: `https://YOUR-USERNAME.github.io/flappy-bird`
   - (Replace `YOUR-USERNAME` and adjust repo name as needed)
2. Site should load
3. Click Google Sign-In
   - Popup opens
   - Sign-in works
   - Redirect to dashboard
   - Check localStorage for `access_token`

### If Workflow Fails

1. Click on the failed workflow run
2. View logs to see error
3. Common fixes:
   - GitHub Secrets not set → add them in Settings
   - Firebase config values wrong → update secrets
   - Backend unreachable → check `API_BASE` secret points to correct server

---

## Validation Checklist

Before declaring success, verify:

- [ ] All 9 GitHub Secrets added (Settings → Secrets and variables → Actions)
- [ ] Firebase Authorized Domains include your GitHub Pages URL + localhost
- [ ] Backend CORS allows GitHub Pages origin
- [ ] Local test works: sign-in popup, token exchange, persistence
- [ ] GitHub Actions workflow runs successfully (green checkmark)
- [ ] GitHub Pages site loads: `https://YOUR-USERNAME.github.io/flappy-bird`
- [ ] Google Sign-In button visible on deployed site
- [ ] Deployed site: click sign-in → popup opens → successful redirect
- [ ] Deployed site: refresh page → user stays logged in (persistence)
- [ ] Browser console shows no errors (F12 → Console)
- [ ] Browser DevTools → Storage → LocalStorage shows `access_token` after sign-in

---

## Support

If stuck:

1. **Check browser console** (F12 → Console tab):
   - Look for Firebase initialization errors
   - Look for CORS errors
   - Look for 404s for `firebase-config.json`

2. **Check GitHub Actions logs**:
   - Repository → Actions → Latest workflow run → View logs
   - Look for errors in "Create firebase-config.json" step

3. **Verify backend is running**:
   - `http://localhost:8000/docs` should show Swagger API docs
   - Backend should log "Uvicorn running on..."

4. **Check Firebase Console**:
   - Authentication → Sign-in method: Google should be enabled
   - Authorized domains should include your URL
   - Project should exist with correct project ID

5. **Test CORS locally**:
   - Open DevTools (F12) → Network tab
   - Attempt sign-in
   - Look for requests to `/api/firebase-auth` with CORS headers

---

## Summary: Full Timeline

1. **Now**: Get Firebase config values (10 min)
2. **Next**: Add GitHub Secrets (5 min)
3. **Then**: Add Firebase Authorized Domains (2 min)
4. **Then**: Update backend CORS (2 min)
5. **Then**: Test locally (10 min)
6. **Finally**: Push to main and deploy (1–2 min workflow run)

**Total time: ~30 minutes**

Questions? Check the logs and error messages first — they usually point to the issue.
