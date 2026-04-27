require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initSchema } = require('./db/initSchema');
const { getPool } = require('./db/pool');
const { getTaskAiConfig, isProviderConfigured } = require('./services/aiConfig');

const chatRouter = require('./routes/chat');
const documentsRouter = require('./routes/documents');
const plannerRouter = require('./routes/planner');
const workflowRouter = require('./routes/workflow');
const authRouter = require('./routes/auth');
const userStateRouter = require('./routes/userState');

const app = express();
const PORT = process.env.PORT || 3001;

function assertEnv() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Add it to server/.env (see server/.env.example).');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('JWT_SECRET is required and must be at least 16 characters.');
    process.exit(1);
  }
}

assertEnv();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/user', userStateRouter);
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/workflow', workflowRouter);

app.get('/api/health', async (req, res) => {
  const tutorConfig = getTaskAiConfig('tutor');
  const plannerConfig = getTaskAiConfig('planner');
  const evaluatorConfig = getTaskAiConfig('evaluator');

  const ai = {
    tutor: { ...tutorConfig, configured: isProviderConfigured(tutorConfig.provider) },
    planner: { ...plannerConfig, configured: isProviderConfigured(plannerConfig.provider) },
    evaluator: { ...evaluatorConfig, configured: isProviderConfigured(evaluatorConfig.provider) },
  };

  const allAiConfigured = Object.values(ai).every(cfg => cfg.configured);
  let database = false;
  try {
    await getPool().query('SELECT 1');
    database = true;
  } catch (e) {
    console.error('Database health check failed:', e.message);
  }
  res.json({
    status: 'ok',
    ai,
    aiConfigured: allAiConfigured,
    database,
    message: allAiConfigured
      ? 'Server is ready. AI providers are configured.'
      : 'Server running but one or more provider API keys are missing. Update server/.env',
  });
});

async function start() {
  try {
    await initSchema();
    console.log('Database schema ready.');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n LetsStudyAI backend running on http://localhost:${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    const tutorConfig = getTaskAiConfig('tutor');
    const plannerConfig = getTaskAiConfig('planner');
    const evaluatorConfig = getTaskAiConfig('evaluator');
    console.log(` Tutor -> ${tutorConfig.provider}:${tutorConfig.model}`);
    console.log(` Planner -> ${plannerConfig.provider}:${plannerConfig.model}`);
    console.log(` Evaluator -> ${evaluatorConfig.provider}:${evaluatorConfig.model}`);
    console.log(' Add provider API keys in server/.env if any agent is not configured.\n');
  });
}

start();
