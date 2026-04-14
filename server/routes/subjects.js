const express = require('express');
const store = require('../data/plannerStore');

const router = express.Router();

// POST /api/subjects
router.post('/', (req, res) => {
  const { name, deadline, priority, difficulty, estimatedHours, topics, color } = req.body;
  if (!name || !deadline) {
    return res.status(400).json({ error: 'name and deadline are required' });
  }

  try {
    const sub = store.addSubject({ name, deadline, priority, difficulty, estimatedHours, topics, color });
    res.status(201).json({ subject: sub });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save subject' });
  }
});

// GET /api/subjects
router.get('/', (req, res) => {
  const subs = store.getSubjects();
  res.json({ subjects: subs });
});

module.exports = router;
