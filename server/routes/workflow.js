const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateForTask } = require('../services/aiClient');
const { buildMessages, getRagContext } = require('../rag/ragEngine');
const { getDocumentChunks } = require('../rag/vectorStore');
const { ensureUserDocumentsIndexed, userOwnsDocument } = require('../services/documentIndex');

const router = express.Router();

router.use(requireAuth);

function extractJsonArray(raw) {
  const match = String(raw || '').match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : null;
}

function extractJsonObject(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

// POST /api/workflow/run
// Runs planner -> tutor -> evaluator in one request
router.post('/run', async (req, res) => {
  const {
    subjects = [],
    tutorQuestion = 'What should I focus on first today?',
    conversationHistory = [],
    documentId = null,
    quizNumQuestions = 5,
    quizFocusTopic = '',
  } = req.body;

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ error: 'subjects array is required' });
  }

  try {
    await ensureUserDocumentsIndexed(req.user.id);
    if (documentId) {
      const owns = await userOwnsDocument(req.user.id, documentId);
      if (!owns) return res.status(404).json({ error: 'Selected document not found.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const subjectSummary = subjects.map(s => ({
      id: s.id,
      name: s.name,
      priority: s.priority,
      deadline: s.deadline,
      topics: s.topics,
      color: s.color,
    }));

    const plannerPrompt = `You are a smart study schedule optimizer. Today is ${todayStr}.
Student's subjects to study:
${JSON.stringify(subjectSummary, null, 2)}

Create an optimized daily study schedule and return ONLY JSON array:
[
  {"id":"sub-xxx-0","subjectId":"sub-xxx","subjectName":"Subject Name","topic":"Topic Name","date":"YYYY-MM-DD","duration":2,"priority":"medium","completed":false,"type":"study","color":"#hexcolor"}
]`;

    const plannerGen = await generateForTask('planner', {
      messages: [
        { role: 'system', content: 'Output ONLY valid JSON array.' },
        { role: 'user', content: plannerPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2500,
    });

    const plannedTasks = extractJsonArray(plannerGen.content) || [];
    plannedTasks.sort((a, b) => new Date(a.date) - new Date(b.date));

    const completed = plannedTasks.filter(t => t.completed).length;
    const total = plannedTasks.length;
    const upcoming = [...subjects]
      .map(s => ({ ...s, daysLeft: Math.ceil((new Date(s.deadline) - new Date()) / (1000 * 60 * 60 * 24)) }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const insightsPrompt = `You are an encouraging study coach. Today is ${todayStr}.
Student subjects: ${subjects.map(s => `${s.name} (${s.priority} priority, deadline: ${s.deadline})`).join(', ')}
Study progress: ${completed} of ${total} tasks completed.
Most urgent: ${upcoming[0]?.name || 'none'} (${upcoming[0]?.daysLeft ?? 0} days left)
Return ONLY JSON object with keys: summary, urgentSubject, encouragement, recommendation.`;

    const plannerInsights = await generateForTask('planner', {
      messages: [
        { role: 'system', content: 'Output ONLY valid JSON object.' },
        { role: 'user', content: insightsPrompt },
      ],
      temperature: 0.6,
      maxTokens: 300,
    });

    const insights = extractJsonObject(plannerInsights.content) || {};

    let { chunks, hasContext } = await getRagContext(tutorQuestion.trim(), req.user.id, documentId || null);
    if (documentId && !hasContext) {
      const selectedDocChunks = getDocumentChunks(req.user.id, documentId);
      if (selectedDocChunks.length > 0) {
        chunks = selectedDocChunks.slice(0, 8);
        hasContext = true;
      }
    }
    const tutorMessages = buildMessages(conversationHistory, tutorQuestion.trim(), chunks);
    const tutorCompletion = await generateForTask('tutor', {
      messages: tutorMessages,
      temperature: 0.7,
      maxTokens: 1024,
    });

    const topSubject = plannedTasks[0]?.subjectName || subjects[0]?.name || 'your study topics';
    const quizPrompt = `Generate exactly ${quizNumQuestions} multiple-choice quiz questions about "${quizFocusTopic || topSubject}".
Return ONLY JSON array with:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]`;

    const evaluatorCompletion = await generateForTask('evaluator', {
      messages: [
        { role: 'system', content: 'You are a quiz generator. Output ONLY valid JSON arrays.' },
        { role: 'user', content: quizPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1800,
    });

    const quizQuestions = extractJsonArray(evaluatorCompletion.content) || [];

    return res.json({
      workflow: 'planner->tutor->evaluator',
      planner: {
        tasks: plannedTasks,
        insights,
        model: plannerGen.model,
        provider: plannerGen.provider,
      },
      tutor: {
        answer: tutorCompletion.content || 'Sorry, I could not generate a response.',
        hasContext,
        sources: chunks.map(c => ({ docName: c.docName, snippet: c.text.slice(0, 120) + '...' })),
        model: tutorCompletion.model,
        provider: tutorCompletion.provider,
      },
      evaluator: {
        questions: quizQuestions,
        topic: quizFocusTopic || topSubject,
        model: evaluatorCompletion.model,
        provider: evaluatorCompletion.provider,
      },
    });
  } catch (err) {
    console.error('Workflow run error:', err);
    if (err.status === 503) {
      return res.status(503).json({ error: `${err.message}. Configure the required provider key in server/.env.` });
    }
    if (err.status === 401) return res.status(401).json({ error: 'Invalid API key for configured provider.' });
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit reached. Please wait and try again.' });
    return res.status(500).json({ error: 'Workflow failed. Please try again.' });
  }
});

module.exports = router;
