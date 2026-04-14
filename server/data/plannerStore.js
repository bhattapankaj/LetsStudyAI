// Simple in-memory store for subjects and generated tasks
const subjects = [];
const tasks = [];

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

module.exports = {
  addSubject(sub) {
    const subject = {
      id: sub.id || generateId('sub'),
      name: sub.name,
      deadline: sub.deadline,
      priority: sub.priority || 'medium',
      difficulty: sub.difficulty || 'medium',
      estimatedHours: sub.estimatedHours || 0,
      topics: Array.isArray(sub.topics) ? sub.topics : [],
      color: sub.color || '#6C63FF',
    };
    subjects.push(subject);
    return subject;
  },

  getSubjects() {
    return subjects.slice();
  },

  clearSubjects() {
    subjects.length = 0;
  },

  saveGeneratedTasks(newTasks) {
    // replace tasks
    tasks.length = 0;
    newTasks.forEach(t => tasks.push(t));
  },

  getTasks() {
    return tasks.slice();
  },

  markTaskComplete(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return null;
    t.completed = true;
    return t;
  },
};
