# LetsStudyAI — AI-Powered Study Assistant

This is our course project for CSCI 4083. We built an AI study assistant that uses multiple agents to help students plan their study schedule, understand topics, and test themselves — all powered by their own uploaded notes.

The big idea: upload your PDF or Word notes, and the AI will answer your questions from them, not just generic stuff.

---

## What It Does

The app has three AI agents, each doing a different job:

- **Planner Agent** — you add your subjects and deadlines, it builds a study schedule for you
- **Tutor Agent** — you ask it questions, it answers using your uploaded notes (RAG)
- **Evaluator Agent** — it generates quiz questions either by topic or directly from your documents

There's also a Documents page where you upload your notes (PDF, DOCX, or TXT) so the AI has something to work with.

---

## How to Run It

You need:
- Docker Desktop (recommended for Postgres), or any Postgres server
- Node.js + npm
- Two terminals (backend + frontend)

### Step 0 — Start PostgreSQL (Docker)

```bash
docker run --name letsstudyai-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=letsstudyai \
  -p 5432:5432 \
  -d postgres:16
```

If the container already exists, start it with:

```bash
docker start letsstudyai-pg
```

Optional quick DB check:

```bash
docker exec -it letsstudyai-pg psql -U postgres -d letsstudyai -c "\dt"
```

### Step 1 — Get a free Groq API key

Go to [console.groq.com](https://console.groq.com) and create an API key.

### Step 2 — Configure backend environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and set:
- `DATABASE_URL` (example: `postgres://postgres:postgres@localhost:5432/letsstudyai`)
- `JWT_SECRET` (random string, at least 16 chars)
- `GROQ_API_KEY` (required for AI features)

### Step 3 — Start backend

```bash
cd server
npm install
npm start
```

Backend runs at `http://localhost:3001` and auto-creates DB tables on startup.

### Step 4 — Start frontend (new terminal)

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### Step 5 — First use

1. Register a new account.
2. Upload documents in **Documents** page.
3. Use Tutor with the document selector (Tutor only answers from the selected document).

---

## Tech Stack

| Part | What we used |
|------|-------------|
| Frontend | React 19, Vite, Framer Motion |
| Backend | Node.js, Express |
| Accounts | JWT + bcrypt, PostgreSQL (`users`, `user_app_state`, `user_documents`) |
| AI / LLM | Groq API (Llama 3) — free |
| Document Search (RAG) | TF-IDF + cosine similarity |
| File Parsing | pdf-parse (PDF), mammoth (DOCX) |

We chose Groq because it's fast and free. We built the RAG system from scratch using TF-IDF instead of using a vector database, which kept things simple and didn't require any extra services.

### Current Tutor behavior

- Tutor is **document-only** (no offline predefined knowledge mode)
- You must pick an uploaded document in Tutor chat
- The selected `documentId` is sent to backend and retrieval is scoped to that document only

---

## Project Structure

```
LetsStudyAI/
├── src/                    # React frontend
│   ├── agents/             # Planner, Tutor, Evaluator agent logic
│   ├── pages/              # Dashboard, Planner, Tutor, Evaluator, Documents, Profile
│   └── context/            # App state (AppContext), Theme (ThemeContext)
├── server/                 # Express backend
│   ├── routes/             # chat.js, documents.js
│   └── rag/                # documentParser.js, vectorStore.js, ragEngine.js
└── README.md
```

---

## Team

| Name | Role |
|------|------|
| Pankaj Bhatta | Tutor Agent + RAG backend |
| Ranjan Lamichhane | System design + integration |
| Aadarsha Aryal | Planner Agent |
| Diwakar Mahato Sudi | Evaluator Agent |

**Course:** CSCI 4083 — Dr. Dileon Saint Jean
