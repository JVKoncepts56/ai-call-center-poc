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

    logger.info('Audio request', {
      cacheKey,
      cacheKeyLength: cacheKey.length,
      inLocalCache: audioCache.has(cacheKey),
      inSharedCache: !!getAudio(cacheKey)
    });

    // Check both caches (local and shared)
    let audioData = audioCache.get(cacheKey) || getAudio(cacheKey);

    if (!audioData) {
      logger.warn('Audio file not found in any cache', {
        cacheKey,
        localCacheSize: audioCache.size,
        availableKeys: Array.from(audioCache.keys()).slice(0, 5)
      });
      return res.status(404).json({
        error: 'Audio not found',
        cacheKey
      });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioData.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(audioData);
    logger.info('Audio served successfully', { cacheKey, size: audioData.length });

    // Clean up local cache after serving (optional - cache for 1 hour)
    setTimeout(() => {
      audioCache.delete(cacheKey);
    }, 3600000);

  } catch (error) {
    logger.error('Error serving audio', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Error serving audio',
      message: error.message
    });
  }
});

/**
 * Store audio in cache and return cache key
 */
async function generateAndCacheAudio(text, voice) {
  try {
    logger.info('Generating audio', {
      textPreview: text.substring(0, 50),
      textLength: text.length,
      voice
    });

    const audioBuffer = await textToSpeech(text, voice);
    const cacheKey = Buffer.from(text).toString('base64').substring(0, 32);

    // Store in both local and shared caches
    audioCache.set(cacheKey, audioBuffer);
    cacheAudio(cacheKey, audioBuffer);

    logger.info('Audio cached successfully', {
      cacheKey,
      audioSize: audioBuffer.length,
      localCacheSize: audioCache.size
    });

    return cacheKey;
  } catch (error) {
    logger.error('Error generating audio', { error: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = {
  router,
  generateAndCacheAudio
};
