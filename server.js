require('dotenv').config();
const express = require('express');
const voiceRoutes = require('./src/routes/voice');
const statusRoutes = require('./src/routes/status');
const adminRoutes = require('./src/routes/admin');
const { router: audioRoutes } = require('./src/routes/audio');

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

  // Preload filler phrase audio for instant responses
  const { preloadFillerPhrases } = require('./src/utils/audioCache');
  const voice = process.env.OPENAI_VOICE || 'shimmer';
  await preloadFillerPhrases(voice);
});

module.exports = app;
