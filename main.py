import os
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager

import aiosqlite
import bcrypt
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel

# ===================== CONFIG =====================
SECRET_KEY = os.getenv("SECRET_KEY", "flappy-bird-neon-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
DB_PATH = "flappy_bird.db"

security = HTTPBearer(auto_error=False)

# ===================== FIREBASE INIT =====================
firebase_cred_path = os.path.join(os.path.dirname(__file__), "credentials.json")
if os.path.exists(firebase_cred_path):
    cred = credentials.Certificate(firebase_cred_path)
    firebase_admin.initialize_app(cred)
    FIREBASE_ENABLED = True
else:
    FIREBASE_ENABLED = False


# ===================== PASSWORD HELPERS =====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ===================== DATABASE =====================
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                avatar_color TEXT DEFAULT '#00c8ff',
                created_at TEXT DEFAULT (datetime('now')),
                last_login TEXT,
                games_played INTEGER DEFAULT 0,
                high_score INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS game_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                played_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================== AUTH HELPERS =====================
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = int(user_id_str)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            user = await cursor.fetchone()
            if user is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
            return dict(user)


# ===================== MODELS =====================
class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str


class LoginPayload(BaseModel):
    username: str
    password: str


class ScorePayload(BaseModel):
    score: int


class AvatarPayload(BaseModel):
    color: str


class FirebasePayload(BaseModel):
    id_token: str


# ===================== AUTH ENDPOINTS =====================
@app.post("/api/register")
async def register(payload: RegisterPayload):
    if len(payload.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    hashed = hash_password(payload.password)
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO users (username, email, hashed_password) VALUES (?, ?, ?)",
                (payload.username, payload.email, hashed),
            )
            await db.commit()
        except aiosqlite.IntegrityError as e:
            if "username" in str(e):
                raise HTTPException(status_code=400, detail="Username already taken")
            raise HTTPException(status_code=400, detail="Email already registered")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id FROM users WHERE username = ?", (payload.username,)) as cursor:
            user = await cursor.fetchone()
            token = create_access_token({"sub": str(dict(user)["id"])})
            return {"access_token": token, "token_type": "bearer", "username": payload.username}


@app.post("/api/login")
async def login(payload: LoginPayload):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE username = ?", (payload.username,)) as cursor:
            user = await cursor.fetchone()
            if user is None or not verify_password(payload.password, dict(user)["hashed_password"]):
                raise HTTPException(status_code=401, detail="Invalid username or password")

            user_dict = dict(user)
            token = create_access_token({"sub": str(user_dict["id"])})
            await db.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user_dict["id"],))
            await db.commit()
            return {"access_token": token, "token_type": "bearer", "username": user_dict["username"]}


@app.post("/api/firebase-auth")
async def firebase_login(payload: FirebasePayload):
    if not FIREBASE_ENABLED:
        raise HTTPException(status_code=501, detail="Firebase authentication is not configured")

    try:
        decoded = firebase_auth.verify_id_token(payload.id_token)
        firebase_uid = decoded["uid"]
        email = decoded.get("email", "")
        display_name = decoded.get("name", "")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")

    # Derive a unique username from Firebase info
    username = display_name if display_name else email.split("@")[0] if email else firebase_uid[:12]

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        # Check if user exists by email
        async with db.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
            user = await cursor.fetchone()

        if user:
            # Existing user - log them in
            user_dict = dict(user)
            token = create_access_token({"sub": str(user_dict["id"])})
            await db.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user_dict["id"]))
            await db.commit()
            return {"access_token": token, "token_type": "bearer", "username": user_dict["username"]}
        else:
            # New user - create account with a placeholder password
            # Ensure username is unique by appending a number if needed
            base_username = username
            counter = 1
            final_username = base_username
            while True:
                async with db.execute("SELECT id FROM users WHERE username = ?", (final_username,)) as cursor:
                    existing = await cursor.fetchone()
                if not existing:
                    break
                counter += 1
                final_username = f"{base_username}{counter}"

            hashed = hash_password(firebase_uid)  # Use firebase UID as placeholder password
            try:
                await db.execute(
                    "INSERT INTO users (username, email, hashed_password) VALUES (?, ?, ?)",
                    (final_username, email, hashed),
                )
                await db.commit()
            except aiosqlite.IntegrityError:
                raise HTTPException(status_code=400, detail="Account creation failed")

            async with db.execute("SELECT id FROM users WHERE email = ?", (email,)) as cursor:
                new_user = await cursor.fetchone()
            token = create_access_token({"sub": str(dict(new_user)["id"])})
            return {"access_token": token, "token_type": "bearer", "username": final_username}


@app.get("/api/firebase-config")
async def get_firebase_config():
    if not FIREBASE_ENABLED:
        return {"enabled": False}
    return {
        "enabled": True,
        "apiKey": "AIzaSyDEr_27Os0rPz1eYs2vxndQ3lSYVQQWv7E",
        "authDomain": "flappy-bird-f246c.firebaseapp.com",
        "databaseURL": "https://flappy-bird-f246c-default-rtdb.firebaseio.com",
        "projectId": "flappy-bird-f246c",
        "storageBucket": "flappy-bird-f246c.firebasestorage.app",
        "messagingSenderId": "55662868227",
        "appId": "1:55662868227:web:6f3468d633b89ccb055b36",
        "measurementId": "G-KKSWHLFCGN",
    }


@app.get("/api/profile")
async def get_profile(user=Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "avatar_color": user["avatar_color"],
        "games_played": user["games_played"],
        "high_score": user["high_score"],
        "total_score": user["total_score"],
        "created_at": user["created_at"],
        "last_login": user["last_login"],
    }


@app.put("/api/profile/avatar")
async def update_avatar(payload: AvatarPayload, user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET avatar_color = ? WHERE id = ?", (payload.color, user["id"]))
        await db.commit()
    return {"avatar_color": payload.color}


# ===================== GAME ENDPOINTS =====================
@app.get("/api/high-score")
async def get_high_score(user=Depends(get_current_user)):
    return {"high_score": user["high_score"]}


@app.post("/api/game-result")
async def submit_game_result(payload: ScorePayload, user=Depends(get_current_user)):
    new_record = False
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO game_history (user_id, score) VALUES (?, ?)",
            (user["id"], payload.score),
        )
        new_games = user["games_played"] + 1
        new_total = user["total_score"] + payload.score
        new_high = user["high_score"]
        if payload.score > user["high_score"]:
            new_high = payload.score
            new_record = True
        await db.execute(
            "UPDATE users SET games_played = ?, high_score = ?, total_score = ? WHERE id = ?",
            (new_games, new_high, new_total, user["id"]),
        )
        await db.commit()

    return {"high_score": new_high, "new_record": new_record, "games_played": new_games}


# ===================== DASHBOARD ENDPOINTS =====================
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT AVG(score) as avg_score FROM game_history WHERE user_id = ?", (user["id"],)
        ) as cursor:
            avg_row = await cursor.fetchone()
            avg_score = round(dict(avg_row)["avg_score"] or 0, 1)

        async with db.execute(
            "SELECT score, played_at FROM game_history WHERE user_id = ? ORDER BY played_at DESC LIMIT 10",
            (user["id"],),
        ) as cursor:
            recent = [dict(row) for row in await cursor.fetchall()]

        async with db.execute(
            "SELECT score, played_at FROM game_history WHERE user_id = ? ORDER BY score DESC LIMIT 1",
            (user["id"],),
        ) as cursor:
            best = await cursor.fetchone()
            best_game = dict(best) if best else None

    return {
        "username": user["username"],
        "avatar_color": user["avatar_color"],
        "games_played": user["games_played"],
        "high_score": user["high_score"],
        "total_score": user["total_score"],
        "avg_score": avg_score,
        "best_game": best_game,
        "recent_games": recent,
    }


@app.get("/api/leaderboard")
async def get_leaderboard():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT username, high_score, avatar_color, games_played FROM users WHERE high_score > 0 ORDER BY high_score DESC LIMIT 10"
        ) as cursor:
            leaders = [dict(row) for row in await cursor.fetchall()]
    return {"leaderboard": leaders}


# ===================== STATIC FILES & PAGES =====================
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/auth.html")


@app.get("/game")
def game_page():
    return FileResponse("static/index.html")


@app.get("/dashboard")
def dashboard_page():
    return FileResponse("static/dashboard.html")
