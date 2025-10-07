require('dotenv').config();
const express = require('express');
const voiceRoutes = require('./src/routes/voice');
const statusRoutes = require('./src/routes/status');
const adminRoutes = require('./src/routes/admin');
const { router: audioRoutes } = require('./src/routes/audio');

// Validate required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'OPENAI_VOICE',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL ERROR: Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these variables in your environment or .env file');
  console.error('Example OPENAI_VOICE values: alloy, echo, fable, onyx, nova, shimmer');
  process.exit(1);
}

console.log('✅ Environment variables validated');
console.log(`   Using OpenAI voice: ${process.env.OPENAI_VOICE}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/webhook/voice', voiceRoutes);
app.use('/webhook/status', statusRoutes);
app.use('/admin', adminRoutes);
app.use('/audio', audioRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`AI Call Center POC running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Preload knowledge base
  const { loadKnowledgeBase } = require('./src/services/openai');
  await loadKnowledgeBase();

  // Preload filler phrase audio for instant responses
  const { preloadFillerPhrases } = require('./src/utils/audioCache');
  const voice = process.env.OPENAI_VOICE;
  await preloadFillerPhrases(voice);

  // Preload greeting message
  const { generateAndCacheAudio } = require('./src/routes/audio');
  const greetingText = 'Welcome to Workforce Shield, Virtual Care and Expert Counsel, Anytime, Any Day. Are you needing help with legal or medical issues?';
  await generateAndCacheAudio(greetingText, voice);
  console.log('✅ Greeting message pre-cached');
});

module.exports = app;
