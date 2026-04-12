# Project Plan — AI-Powered Personal Study Assistant

**Course:** CSCI 4083  
**Instructor:** Dr. Dileon Saint Jean  
**Group Members:** Pankaj Bhatta, Ranjan Lamichhane, Aadarsha Aryal, Diwakar Mahato Sudi

---

## What We're Building

We're building a web app called **LetsStudyAI** — a personal study assistant that uses multiple AI agents to help students study more effectively.

The problem we're solving: students have a lot of notes and study material but don't have a smart way to review them or get personalized help. Our app lets students upload their own notes and then ask questions from them, get a study schedule, and test themselves with quizzes — all in one place.

---

## The Three AI Agents

The project requirement says we need at least three types of AI agents. Here's what each one does:

### 1. Planner Agent
A goal-based agent. The student enters their subjects and deadlines, and the Planner Agent figures out a daily study schedule. It breaks bigger subjects into smaller sessions and assigns more time to high-priority ones.

### 2. Tutor Agent
A learning agent with RAG (Retrieval Augmented Generation). The student uploads their notes (PDF, Word, or text files), and when they ask a question, the Tutor Agent searches through those notes to find the relevant parts, then sends that context to the LLM to generate an answer. So the answer comes from the student's own material — not random internet stuff.

### 3. Evaluator Agent
A utility agent. It generates multiple-choice quiz questions either from a general topic bank or directly from the student's uploaded documents. After the student completes the quiz, it scores it, gives feedback, and tracks performance over time.

All three agents work together. The Planner helps you know what to study, the Tutor helps you understand it, and the Evaluator checks if you actually learned it.

---

## How It Works (Architecture)

```
Student uploads notes (PDF/DOCX/TXT)
         ↓
Backend parses the file → splits into text chunks
         ↓
Chunks are stored in an in-memory TF-IDF vector store
         ↓
Student asks a question in the Tutor chat
         ↓
RAG Engine searches the vector store for relevant chunks
         ↓
Relevant chunks + student's question → sent to Groq LLM (Llama 3)
         ↓
AI generates an answer based on the student's own notes
```

For the Evaluator Agent, the same document content gets sent to the LLM with a prompt asking it to generate MCQ questions from that material.

---

## Technology Choices

| Technology | Why we chose it |
|-----------|----------------|
| React + Vite | Fast to build UI, we already knew React |
| Node.js + Express | Simple to set up, good for REST APIs |
| Groq API (Llama 3) | Completely free, very fast responses |
| TF-IDF vector search | No external database needed, works in-memory |
| pdf-parse + mammoth | Parse PDF and Word files without paid services |

We deliberately kept the tech stack simple and free. No paid APIs, no external databases. Everything runs locally.

---

## Task Breakdown

| Week | Task | Who |
|------|------|-----|
| Week 1 | Project planning, UI wireframes, basic React setup | All |
| Week 2 | Planner Agent — schedule generation logic | Aadarsha |
| Week 2 | Evaluator Agent — quiz bank and scoring system | Diwakar |
| Week 3 | Tutor Agent — backend setup, RAG pipeline, Groq integration | Pankaj |
| Week 3 | Documents page — file upload and display | Pankaj |
| Week 4 | System integration — connect all agents, routing, sidebar | Ranjan |
| Week 4 | Evaluator upgrade — AI quiz from uploaded documents | Diwakar |
| Week 5 | UI polish, testing, bug fixes | All |
| Week 6 | Final testing, README, demo prep | All |

---

## Individual Responsibilities

**Pankaj Bhatta**
- Built the entire Express.js backend
- Implemented the RAG pipeline (document parser, vector store, RAG engine)
- Integrated Groq API for real AI responses
- Upgraded the Tutor Agent to use AI instead of hardcoded answers
- Built the Documents upload page

**Aadarsha Aryal**
- Designed and built the Planner Agent logic
- Schedule generation based on subjects, priorities, and deadlines

**Diwakar Mahato Sudi**
- Built the Evaluator Agent with the question bank
- Implemented quiz scoring and performance tracking
- Added AI-based quiz generation from uploaded documents

**Ranjan Lamichhane**
- Overall system design and architecture decisions
- Frontend integration — connecting all pages and agents together
- App routing and state management

---

## What Makes This a Multi-Agent System

Each agent is independent and has its own goal:

- The **Planner Agent** doesn't know anything about quizzes or chat — it only cares about scheduling
- The **Tutor Agent** doesn't know about the schedule — it only cares about answering questions accurately
- The **Evaluator Agent** doesn't care how you studied — it only cares about testing what you know

They share the same uploaded documents (through the RAG system) but operate independently. This is what makes it a multi-agent system rather than just one big app.

---

## What We Learned

- How RAG works in practice — connecting document search to an LLM
- How to build a REST API with file upload support
- How to use a free LLM API (Groq) effectively
- How to structure a multi-agent system where agents have separate responsibilities
- That TF-IDF is surprisingly effective for document search without needing a vector database

---

## Known Limitations

- The vector store is in-memory, so uploaded documents are lost when the server restarts
- TF-IDF search is keyword-based — very specific or vague queries might not find the right chunks
- The app needs both the frontend and backend running locally to work fully
