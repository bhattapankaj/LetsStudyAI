const express = require('express');
const { buildMessages, getRagContext } = require('../rag/ragEngine');
const { getDocumentChunks } = require('../rag/vectorStore');
const { requireAuth } = require('../middleware/auth');
const { ensureUserDocumentsIndexed, userOwnsDocument } = require('../services/documentIndex');
const { generateForTask } = require('../services/aiClient');

const router = express.Router();

router.use(requireAuth);

// POST /api/chat
router.post('/', async (req, res) => {
  const { message, conversationHistory = [], documentId } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    await ensureUserDocumentsIndexed(req.user.id);
    if (documentId) {
      const owns = await userOwnsDocument(req.user.id, documentId);
      if (!owns) {
        return res.status(404).json({ error: 'Selected document not found.' });
      }
    }

    let { chunks, hasContext } = await getRagContext(message.trim(), req.user.id, documentId || null);

    // If a specific document is selected but query-term retrieval is too strict,
    // fall back to sending chunks from that selected document so requests like
    // "summarize my notes" still have document context.
    if (documentId && !hasContext) {
      const selectedDocChunks = getDocumentChunks(req.user.id, documentId);
      if (selectedDocChunks.length > 0) {
        chunks = selectedDocChunks.slice(0, 8);
        hasContext = true;
      }
    }

    const messages = buildMessages(conversationHistory, message.trim(), chunks);

    const completion = await generateForTask('tutor', {
      messages,
      temperature: 0.7,
      maxTokens: 1024,
    });

    const answer = completion.content || 'Sorry, I could not generate a response.';

    res.json({
      answer,
      hasContext,
      sources: chunks.map(c => ({ docName: c.docName, snippet: c.text.slice(0, 120) + '...' })),
      model: completion.model,
      provider: completion.provider,
      usage: completion.usage,
    });
  } catch (err) {
    console.error('Tutor AI error:', err);

    if (err.status === 503) {
      return res.status(503).json({
        error: `${err.message}. Configure the required provider key in server/.env.`,
      });
    }

    if (err.status === 401) return res.status(401).json({ error: 'Invalid API key for configured provider.' });
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit reached. Please wait and try again.' });
    res.status(500).json({ error: 'Failed to get AI response. Please try again.' });
  }
});

// POST /api/chat/generate-quiz
router.post('/generate-quiz', async (req, res) => {
  const { topic, subject, numQuestions = 5, documentId, focusTopic } = req.body;

  let contextText = '';
  let quizTopic = topic || focusTopic || 'the document';
  let quizSubject = subject || 'Study Notes';
  let sourceDoc = null;

  if (documentId) {
    await ensureUserDocumentsIndexed(req.user.id);
    const owns = await userOwnsDocument(req.user.id, documentId);
    if (!owns) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const docChunks = getDocumentChunks(req.user.id, documentId);
    if (docChunks.length === 0) {
      return res.status(404).json({ error: 'Document not found or has no indexed content.' });
    }

    sourceDoc = docChunks[0].docName;
    quizTopic = focusTopic || sourceDoc;
    quizSubject = 'Document Quiz';

    const allText = docChunks.map(c => c.text).join('\n\n');
    const trimmed = allText.length > 6000 ? allText.slice(0, 6000) + '...' : allText;

    contextText = `You are generating quiz questions STRICTLY based on the following document content.\n\nDocument: "${sourceDoc}"\n\nContent:\n${trimmed}\n\n`;
  } else {
    await ensureUserDocumentsIndexed(req.user.id);
    const { chunks } = await getRagContext(`${subject} ${topic} questions quiz`, req.user.id);
    if (chunks.length > 0) {
      contextText = `Use these relevant student notes as additional context:\n${chunks.map(c => c.text).join('\n\n')}\n\n`;
    }
  }

  const focusLine = focusTopic
    ? `Focus specifically on the subtopic: "${focusTopic}".`
    : '';

  const prompt = `${contextText}Generate exactly ${numQuestions} multiple-choice quiz questions${documentId ? ' based ONLY on the document content above' : ` about "${quizTopic}" in ${quizSubject}`}. ${focusLine}

Rules:
- All questions and answers must come from the provided content only (if document mode)
- Each question must have exactly 4 answer options
- Only one option should be correct
- The explanation must reference the content

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Why this answer is correct, referencing the document"
  }
]

The "correct" field is the 0-based index of the correct option. Return only the JSON array, no other text.`;

  try {
    const completion = await generateForTask('evaluator', {
      messages: [
        { role: 'system', content: 'You are a quiz generator. You output ONLY valid JSON arrays. No markdown, no explanation, just the JSON array.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      maxTokens: 3000,
    });

    const raw = completion.content || '[]';

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse quiz from AI response.' });
    }

    const questions = JSON.parse(jsonMatch[0]);
    res.json({ questions, topic: quizTopic, subject: quizSubject, sourceDoc, model: completion.model, provider: completion.provider });
  } catch (err) {
    console.error('Quiz generation error:', err);
    if (err.status === 503) return res.status(503).json({ error: `${err.message}. Configure the required provider key in server/.env.` });
    if (err.status === 401) return res.status(401).json({ error: 'Invalid API key for evaluator provider.' });
    if (err.status === 429) return res.status(429).json({ error: 'Evaluator rate limit reached. Please try again.' });
    if (err.status === 404 || err.code === 404) {
      return res.status(500).json({ error: `Evaluator model not available: ${err.message || 'model not found'}` });
    }
    res.status(500).json({ error: err.message || 'Failed to generate quiz. Please try again.' });
  }
});

module.exports = router;
