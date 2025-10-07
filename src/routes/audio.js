const express = require('express');
const router = express.Router();
const { textToSpeech } = require('../services/openai');
const { getAudio, cacheAudio } = require('../utils/audioCache');
const logger = require('../utils/logger');

// In-memory cache for audio files (temporary)
const audioCache = new Map();

/**
 * GET /audio/:cacheKey
 * Serves generated audio files
 */
router.get('/:cacheKey', async (req, res) => {
  try {
    const { cacheKey } = req.params;

    // Check both caches (local and shared)
    let audioData = audioCache.get(cacheKey) || getAudio(cacheKey);

    if (!audioData) {
      logger.warn('Audio file not found', { cacheKey });
      return res.status(404).send('Audio not found');
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioData.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(audioData);

    // Clean up local cache after serving (optional - cache for 1 hour)
    setTimeout(() => {
      audioCache.delete(cacheKey);
    }, 3600000);

  } catch (error) {
    logger.error('Error serving audio', { error: error.message });
    res.status(500).send('Error serving audio');
  }
});

/**
 * Store audio in cache and return cache key
 */
async function generateAndCacheAudio(text, voice = 'nova') {
  try {
    const audioBuffer = await textToSpeech(text, voice);
    const cacheKey = Buffer.from(text).toString('base64').substring(0, 32);
    audioCache.set(cacheKey, audioBuffer);
    return cacheKey;
  } catch (error) {
    logger.error('Error generating audio', { error: error.message });
    throw error;
  }
}

module.exports = {
  router,
  generateAndCacheAudio
};
