const Groq = require('groq-sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getApiKeyForProvider, getTaskAiConfig } = require('./aiConfig');

const clients = {
  groq: null,
  openai: null,
  gemini: null,
  openrouter: null,
};

function getClientForProvider(provider) {
  const apiKey = getApiKeyForProvider(provider);
  if (!apiKey) return null;

  if (provider === 'groq') {
    if (!clients.groq) clients.groq = new Groq({ apiKey });
    return clients.groq;
  }

  if (provider === 'openai') {
    if (!clients.openai) clients.openai = new OpenAI({ apiKey });
    return clients.openai;
  }

  if (provider === 'gemini') {
    if (!clients.gemini) clients.gemini = new GoogleGenerativeAI(apiKey);
    return clients.gemini;
  }

  if (provider === 'openrouter') {
    if (!clients.openrouter) {
      clients.openrouter = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
    return clients.openrouter;
  }

  return null;
}

function messagesToGeminiPrompt(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}:\n${m.content}`)
    .join('\n\n');
}

async function generateForGroq(client, config, options) {
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    stream: false,
  });

  return {
    provider: 'groq',
    model: completion.model,
    content: completion.choices?.[0]?.message?.content || '',
    usage: completion.usage,
  };
}

async function generateForOpenAi(client, config, options) {
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  return {
    provider: 'openai',
    model: completion.model,
    content: completion.choices?.[0]?.message?.content || '',
    usage: completion.usage,
  };
}

async function generateForOpenRouter(client, config, options) {
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  return {
    provider: 'openrouter',
    model: completion.model,
    content: completion.choices?.[0]?.message?.content || '',
    usage: completion.usage,
  };
}

async function generateForGemini(client, config, options) {
  const model = client.getGenerativeModel({ model: config.model });
  const prompt = messagesToGeminiPrompt(options.messages);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    },
  });

  const response = result.response;
  return {
    provider: 'gemini',
    model: config.model,
    content: response.text() || '',
    usage: response.usageMetadata || null,
  };
}

async function generateForTask(task, options) {
  const config = getTaskAiConfig(task);
  const client = getClientForProvider(config.provider);

  if (!client) {
    const envName =
      config.provider === 'groq'
        ? 'GROQ_API_KEY'
        : config.provider === 'openai'
          ? 'OPENAI_API_KEY'
          : config.provider === 'gemini'
            ? 'GEMINI_API_KEY'
            : 'OPENROUTER_API_KEY';
    const err = new Error(`${envName} is not configured`);
    err.status = 503;
    throw err;
  }

  if (config.provider === 'groq') return generateForGroq(client, config, options);
  if (config.provider === 'openai') return generateForOpenAi(client, config, options);
  if (config.provider === 'gemini') return generateForGemini(client, config, options);
  if (config.provider === 'openrouter') return generateForOpenRouter(client, config, options);

  const err = new Error(`Unsupported provider: ${config.provider}`);
  err.status = 500;
  throw err;
}

module.exports = {
  generateForTask,
};
