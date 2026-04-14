// Server-side planner generation logic
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatDate(d) {
  return startOfDay(d).toISOString().split('T')[0];
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function priorityWeight(priority) {
  switch ((priority || '').toLowerCase()) {
    case 'high':
      return 1.3;
    case 'low':
      return 0.9;
    default:
      return 1.0;
  }
}

function difficultyFactor(difficulty) {
  switch ((difficulty || '').toLowerCase()) {
    case 'hard':
      return 1.25;
    case 'easy':
      return 0.85;
    default:
      return 1.0;
  }
}

function estimateSessions(estimatedHours, perSessionHours) {
  if (!estimatedHours || estimatedHours <= 0) return 1;
  return Math.max(1, Math.ceil(estimatedHours / perSessionHours));
}

function* dateRange(start, end) {
  const cur = startOfDay(start);
  const last = startOfDay(end);
  while (cur <= last) {
    yield new Date(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

function generateTasksFromSubjects(subjects) {
  const today = startOfDay(new Date());
  const dayCapacity = {}; // dateStr -> hours scheduled
  const tasks = [];

  // helper to find a date for a session with available capacity (<=6h)
  function findDateForSession(preferredDate, maxDate, duration) {
    const maxCap = 6;
    const start = startOfDay(preferredDate);
    const end = startOfDay(maxDate);
    // try to place on preferred then search forward
    const days = [];
    for (const d of dateRange(start, end)) days.push(d);

    // prefer spaced distribution: try offsets 0, +/-1, +/-2 ...
    for (let i = 0; i < days.length; i++) {
      const cand = days[i];
      const key = formatDate(cand);
      const used = dayCapacity[key] || 0;
      if (used + duration <= maxCap) return cand;
    }
    // fallback: return last day
    return end;
  }

  subjects.forEach(subject => {
    const sid = subject.id || `sub-${Math.round(Math.random() * 1e6)}`;
    const deadline = subject.deadline ? new Date(subject.deadline) : new Date();
    const dlDay = startOfDay(deadline);
    const totalDays = Math.max(1, Math.ceil((dlDay - today) / MS_PER_DAY));

    const topics = Array.isArray(subject.topics) && subject.topics.length > 0
      ? subject.topics
      : ['General'];

    // base per-session hours depending on priority
    const baseSession = subject.priority === 'high' ? 2.5 : subject.priority === 'low' ? 1.25 : 2;

    const diffFactor = difficultyFactor(subject.difficulty);
    const prioFactor = priorityWeight(subject.priority);

    const estHours = subject.estimatedHours && subject.estimatedHours > 0
      ? subject.estimatedHours * diffFactor * prioFactor
      : topics.length * baseSession;

    const perSessionHours = clamp(baseSession, 1, 3);
    const sessions = estimateSessions(estHours, perSessionHours);

    // spread sessions roughly evenly across available days (excluding revision day)
    const availableDays = Math.max(1, totalDays - 1); // reserve 1 day for revision
    const interval = Math.max(1, Math.floor(availableDays / sessions));

    let topicIdx = 0;
    let placed = 0;
    for (let s = 0; s < sessions; s++) {
      const offsetDays = Math.min(s * interval, availableDays - 1);
      const preferredDate = new Date(today);
      preferredDate.setDate(preferredDate.getDate() + offsetDays);

      const sessionDate = findDateForSession(preferredDate, dlDay, perSessionHours);
      const dstr = formatDate(sessionDate);
      dayCapacity[dstr] = (dayCapacity[dstr] || 0) + perSessionHours;

      const task = {
        id: `${sid}-s-${s}-${Math.round(Math.random() * 1e6)}`,
        subjectId: sid,
        subjectName: subject.name,
        topic: topics[topicIdx % topics.length],
        date: dstr,
        duration: perSessionHours,
        priority: subject.priority || 'medium',
        completed: false,
        type: 'study',
        color: subject.color || '#6C63FF',
      };
      tasks.push(task);
      topicIdx += 1;
      placed += 1;
    }

    // Add a revision session 1 day before deadline if it is in the future
    const revisionDate = new Date(dlDay);
    revisionDate.setDate(revisionDate.getDate() - 1);
    if (revisionDate >= today) {
      const rStr = formatDate(revisionDate);
      const revHours = Math.min(2, perSessionHours);
      dayCapacity[rStr] = (dayCapacity[rStr] || 0) + revHours;
      tasks.push({
        id: `${sid}-revision-${Math.round(Math.random() * 1e6)}`,
        subjectId: sid,
        subjectName: subject.name,
        topic: `Revision: All ${subject.name} topics`,
        date: rStr,
        duration: revHours,
        priority: 'high',
        completed: false,
        type: 'revision',
        color: subject.color || '#6C63FF',
      });
    }
  });

  // final sort
  tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
  return tasks;
}

module.exports = { generateTasksFromSubjects };
