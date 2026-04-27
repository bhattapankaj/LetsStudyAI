const VALID_PROVIDERS = new Set(['groq', 'openai', 'gemini', 'openrouter']);

const DEFAULT_TASK_CONFIG = {
  tutor: { provider: 'groq', model: 'llama-3.1-8b-instant' },
  planner: { provider: 'gemini', model: 'gemini-1.5-flash' },
  evaluator: { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free' },
};

function normalizeTask(task) {
  if (task === 'quiz') return 'evaluator';
  if (task === 'plannerGenerate' || task === 'plannerInsights') return 'planner';
  return task;
}

function normalizeProvider(value) {
  if (!value) return null;
  const provider = String(value).toLowerCase().trim();
  return VALID_PROVIDERS.has(provider) ? provider : null;
}

function getProviderForTask(task) {
  const normalizedTask = normalizeTask(task);
  const provider = normalizeProvider(process.env[`AI_PROVIDER_${normalizedTask.toUpperCase()}`]);
  if (provider) return provider;
  return DEFAULT_TASK_CONFIG[normalizedTask]?.provider || 'groq';
}

function getModelForTask(task) {
  const normalizedTask = normalizeTask(task);
  const provider = getProviderForTask(normalizedTask);
  const taskKey = normalizedTask.toUpperCase();

  const explicitModel = process.env[`AI_MODEL_${taskKey}`];
  if (explicitModel) return explicitModel;

  // Backward-compatible Groq model keys
  if (provider === 'groq') {
    const legacyGlobalModel = process.env.GROQ_MODEL;
    const legacyModelMap = {
      tutor: process.env.GROQ_MODEL_TUTOR,
      evaluator: process.env.GROQ_MODEL_EVALUATOR || process.env.GROQ_MODEL_QUIZ,
      planner:
        process.env.GROQ_MODEL_PLANNER ||
        process.env.GROQ_MODEL_PLANNER_GENERATE ||
        process.env.GROQ_MODEL_PLANNER_INSIGHTS,
    };
    return legacyModelMap[normalizedTask] || legacyGlobalModel || DEFAULT_TASK_CONFIG[normalizedTask]?.model;
  }

  return DEFAULT_TASK_CONFIG[normalizedTask]?.model || null;
}

function getApiKeyForProvider(provider) {
  if (provider === 'groq') return process.env.GROQ_API_KEY;
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
  return null;
}

function isProviderConfigured(provider) {
  const apiKey = getApiKeyForProvider(provider);
  return Boolean(apiKey && String(apiKey).trim());
}

function getTaskAiConfig(task) {
  const normalizedTask = normalizeTask(task);
  return {
    task: normalizedTask,
    provider: getProviderForTask(normalizedTask),
    model: getModelForTask(normalizedTask),
  };
}

module.exports = {
  getModelForTask,
  getProviderForTask,
  getApiKeyForProvider,
  isProviderConfigured,
  getTaskAiConfig,
};
