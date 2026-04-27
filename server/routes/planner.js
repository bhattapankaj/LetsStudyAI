const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateForTask } = require('../services/aiClient');

const router = express.Router();

router.use(requireAuth);

const MAX_DAILY_HOURS = 6;

function toIsoDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function getHoursByPriority(priority) {
  if (priority === 'high') return 3;
  if (priority === 'low') return 1;
  return 2;
}

function normalizeTask(rawTask, index, subjectsById, todayStr) {
  const subject = subjectsById.get(rawTask.subjectId);
  if (!subject) return null;

  const rawDate = rawTask.date || todayStr;
  const boundedDate = rawDate < todayStr ? todayStr : rawDate;
  const date = subject.deadline && boundedDate > subject.deadline ? subject.deadline : boundedDate;
  const priority = rawTask.priority || subject.priority || 'medium';
  const duration = Number(rawTask.duration) > 0 ? Number(rawTask.duration) : getHoursByPriority(priority);

  return {
    id: rawTask.id || `${subject.id}-${index}`,
    subjectId: subject.id,
    subjectName: subject.name,
    topic: rawTask.topic || subject.topics?.[0] || 'Study Session',
    date,
    duration,
    priority,
    completed: Boolean(rawTask.completed),
    type: rawTask.type === 'revision' ? 'revision' : 'study',
    color: rawTask.color || subject.color || '#6366f1',
  };
}

function balanceDailyHours(tasks, subjectsById, todayStr) {
  const usage = new Map();

  for (const task of tasks) {
    const used = usage.get(task.date) || 0;
    if (used + task.duration <= MAX_DAILY_HOURS) {
      usage.set(task.date, used + task.duration);
      continue;
    }

    const subject = subjectsById.get(task.subjectId);
    const hardStop = subject?.deadline || addDays(todayStr, 30);
    let candidate = task.date;
    let assigned = false;

    while (candidate <= hardStop) {
      const dayUsed = usage.get(candidate) || 0;
      if (dayUsed + task.duration <= MAX_DAILY_HOURS) {
        task.date = candidate;
        usage.set(candidate, dayUsed + task.duration);
        assigned = true;
        break;
      }
      candidate = addDays(candidate, 1);
    }

    if (!assigned) {
      // Keep task on original date as a last resort, but cap duration.
      task.duration = Math.max(1, MAX_DAILY_HOURS - (usage.get(task.date) || 0));
      usage.set(task.date, (usage.get(task.date) || 0) + task.duration);
    }
  }
}

function ensureRevisionTasks(tasks, subjects, todayStr) {
  for (const subject of subjects) {
    const hasRevision = tasks.some(
      t => t.subjectId === subject.id && t.type === 'revision'
    );
    if (hasRevision) continue;

    const revisionDate = subject.deadline ? addDays(subject.deadline, -1) : addDays(todayStr, 1);
    tasks.push({
      id: `${subject.id}-revision`,
      subjectId: subject.id,
      subjectName: subject.name,
      topic: `${subject.name} Revision`,
      date: revisionDate < todayStr ? todayStr : revisionDate,
      duration: 1,
      priority: subject.priority || 'medium',
      completed: false,
      type: 'revision',
      color: subject.color || '#6366f1',
    });
  }
}

// POST /api/planner/generate
// AI-powered study schedule generation
router.post('/generate', async (req, res) => {
  const { subjects } = req.body;

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ error: 'subjects array is required' });
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

  const prompt = `You are a smart study schedule optimizer. Today is ${todayStr}.

Student's subjects to study:
${JSON.stringify(subjectSummary, null, 2)}

Create an optimized daily study schedule. Rules:
- Only schedule sessions from ${todayStr} onwards (no past dates)
- High priority subjects: 3 hours/session. Medium: 2 hours. Low: 1 hour.
- Spread each subject's topics evenly across the available days before its deadline
- Add exactly 1 revision session per subject, scheduled 1 day before its deadline
- Do NOT schedule more than 6 total study hours on any single day
- Prefer shorter frequent sessions over one long block for the same subject
- Balance subject load so no single subject dominates one day
- Use the EXACT subjectId and color from the input

Return ONLY a valid JSON array, no markdown fences, no explanations:
[
  {
    "id": "sub-xxx-0",
    "subjectId": "sub-xxx",
    "subjectName": "Subject Name",
    "topic": "Topic Name",
    "date": "YYYY-MM-DD",
    "duration": 2,
    "priority": "medium",
    "completed": false,
    "type": "study",
    "color": "#hexcolor"
  }
]`;

  try {
    const completion = await generateForTask('planner', {
      messages: [
        {
          role: 'system',
          content: 'You are a study schedule generator. Output ONLY a valid JSON array. No markdown code fences, no explanations, just the raw JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 4000,
    });

    const raw = completion.content || '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse AI schedule', fallback: true });
    }

    const rawTasks = JSON.parse(jsonMatch[0]);
    const subjectsById = new Map(subjects.map(s => [s.id, s]));

    let tasks = rawTasks
      .map((task, index) => normalizeTask(task, index, subjectsById, todayStr))
      .filter(Boolean);

    ensureRevisionTasks(tasks, subjects, todayStr);
    tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    balanceDailyHours(tasks, subjectsById, todayStr);
    tasks.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ tasks, aiGenerated: true, model: completion.model, provider: completion.provider });
  } catch (err) {
    console.error('Planner AI generate error:', err);
    if (err.status === 503) return res.status(503).json({ error: `${err.message}. Configure the required provider key in server/.env.`, fallback: true });
    if (err.status === 429) {
      return res.status(429).json({ error: 'Rate limit reached', fallback: true });
    }
    res.status(500).json({ error: 'AI generation failed', fallback: true });
  }
});

// POST /api/planner/insights
// Returns a short personalized coaching message for the student
router.post('/insights', async (req, res) => {
  const { subjects, studyPlan } = req.body;

  if (!subjects || subjects.length === 0) {
    return res.status(400).json({ error: 'subjects required' });
  }

  const today = new Date().toISOString().split('T')[0];
  const completed = studyPlan ? studyPlan.filter(t => t.completed).length : 0;
  const total = studyPlan ? studyPlan.length : 0;

  // Find most urgent subject (earliest deadline)
  const upcoming = subjects
    .map(s => ({ ...s, daysLeft: Math.ceil((new Date(s.deadline) - new Date()) / (1000 * 60 * 60 * 24)) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const prompt = `You are an encouraging study coach. Today is ${today}.

Student subjects: ${subjects.map(s => `${s.name} (${s.priority} priority, deadline: ${s.deadline})`).join(', ')}
Study progress: ${completed} of ${total} tasks completed (${total > 0 ? Math.round((completed / total) * 100) : 0}%)
Most urgent: ${upcoming[0]?.name || 'none'} (${upcoming[0]?.daysLeft ?? 0} days left)

Give a brief, personalized coaching response in this exact JSON format:
{
  "summary": "One sentence about their overall study situation",
  "urgentSubject": "${upcoming[0]?.name || null}",
  "encouragement": "One motivating sentence tailored to their progress",
  "recommendation": "One specific actionable thing they should do today"
}

Return ONLY the JSON object. No markdown, no extra text.`;

  try {
    const completion = await generateForTask('planner', {
      messages: [
        { role: 'system', content: 'Output ONLY valid JSON. No markdown fences.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      maxTokens: 300,
    });

    const raw = completion.content || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Parse error' });

    res.json({ ...JSON.parse(jsonMatch[0]), model: completion.model, provider: completion.provider });
  } catch (err) {
    console.error('Planner insights error:', err);
    if (err.status === 503) return res.status(503).json({ error: `${err.message}. Configure the required provider key in server/.env.` });
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

module.exports = router;
