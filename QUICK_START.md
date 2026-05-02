# 🚀 Quick Start - Do This Now

**All code is ready. You just need to do these manual steps (30 min total).**

---

## 1️⃣ Get Firebase Config (from Firebase Console)

```
Firebase Console → Project: flappy-bird-f246c
→ Settings ⚙️ (top-left)
→ General tab
→ Scroll to "Your apps"
→ Find Web app
→ Click </> icon
→ Copy config
```

You need:
- `apiKey`
- `messagingSenderId`
- `appId`
- `measurementId`

---

## 2️⃣ Add GitHub Secrets (takes 3 minutes)

Go to: **https://github.com/YOUR-USERNAME/flappy-bird/settings/secrets/actions**

Click **New repository secret** for each:

```
FIREBASE_API_KEY = (paste your apiKey)
FIREBASE_AUTH_DOMAIN = flappy-bird-f246c.firebaseapp.com
FIREBASE_PROJECT_ID = flappy-bird-f246c
FIREBASE_DATABASE_URL = https://flappy-bird-f246c.firebaseio.com
FIREBASE_STORAGE_BUCKET = flappy-bird-f246c.appspot.com
FIREBASE_MESSAGING_SENDER_ID = (paste your messagingSenderId)
FIREBASE_APP_ID = (paste your appId)
FIREBASE_MEASUREMENT_ID = (paste your measurementId)
API_BASE = https://your-backend-domain.com
```

**For testing locally, set API_BASE to:** `http://localhost:8000`

---

## 3️⃣ Add Firebase Authorized Domains (takes 1 minute)

Go to: **https://console.firebase.google.com/project/flappy-bird-f246c/authentication/settings**

Scroll to "Authorized domains" → Click **Add domain**

Add these:
- `YOUR-USERNAME.github.io` (replace YOUR-USERNAME)
- `localhost`
- `127.0.0.1`
- Your backend domain (if you have one)

---

## 4️⃣ Update Backend CORS (takes 1 minute)

Edit `main.py` and add this at the top (before routes):

```python
from fastapi.middleware.cors import CORSMiddleware

# After: app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://YOUR-USERNAME.github.io",
        "http://localhost:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then restart:
```bash
uvicorn main:app --reload
```

---

## 5️⃣ Optional: Test Locally (takes 10 min)

**Terminal 1: Start Backend**
```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

**Terminal 2: Create Local Config**
```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
.\setup-local-config.ps1
```

Then edit `static/firebase-config.json` and put your Firebase values in.

**Terminal 3: Serve Frontend**
```bash
cd E:\ACADEMIC\3.2\blended\flappy-bird
python -m http.server 8001 --directory .
```

**Test**: Open `http://localhost:8001` and click Google Sign-In button.

---

## 6️⃣ Validate Setup (takes 1 min)

```bash
python validate-setup.py
```

Should say: ✓ All checks passed!

---

## 7️⃣ Deploy! (automatic)

```bash
git add -A
git commit -m "Deploy to GitHub Pages"
git push origin main
```

Then:
1. Go to: https://github.com/YOUR-USERNAME/flappy-bird
2. Click **Actions** tab
3. Watch workflow complete (green ✓)
4. Visit: https://YOUR-USERNAME.github.io/flappy-bird
5. Test Google Sign-In works!

---

## 📚 Need Details?

- **Step-by-step guide**: Open `GITHUB_FIREBASE_SETUP.md`
- **Troubleshooting**: See `README_DEPLOY.md` 
- **Full overview**: See `DEPLOYMENT_READY.md`

---

## ✅ You're Done When:

- GitHub Secrets are set ✓
- Firebase Authorized Domains include your GitHub Pages URL ✓
- Backend CORS updated ✓
- GitHub Pages site loads at `https://YOUR-USERNAME.github.io/flappy-bird` ✓
- Google Sign-In button works on deployed site ✓
- Can sign-in and redirect to dashboard ✓
- User stays logged in after page refresh ✓

**That's it! Good luck! 🎉**
