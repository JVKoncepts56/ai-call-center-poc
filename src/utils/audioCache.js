const { textToSpeech } = require('../services/openai');
const logger = require('./logger');

// Pre-cached audio for instant responses
const audioCacheStore = new Map();

const FILLER_PHRASES = [
  'Let me help you with that.',
  'Sure, let me check that for you.',
  'Great question.',
  'Absolutely, here\'s what I can tell you.',
  'Let me find that information.',
  'One moment please.'
];

/**
 * Pre-generate and cache filler phrase audio on startup
 */
async function preloadFillerPhrases(voice = 'shimmer') {
  logger.info('Preloading filler phrase audio...');

  try {
    for (const phrase of FILLER_PHRASES) {
      const audioBuffer = await textToSpeech(phrase, voice);
      const cacheKey = `filler_${Buffer.from(phrase).toString('base64').substring(0, 20)}`;
      audioCacheStore.set(cacheKey, audioBuffer);
      logger.info(`Cached filler: "${phrase}"`);
    }
    logger.info(`Successfully preloaded ${FILLER_PHRASES.length} filler phrases`);
  } catch (error) {
    logger.error('Error preloading filler phrases:', error);
  }
}

/**
 * Get a random pre-cached filler phrase
 */
function getRandomFillerAudio() {
  const randomPhrase = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
  const cacheKey = `filler_${Buffer.from(randomPhrase).toString('base64').substring(0, 20)}`;
  return {
    audio: audioCacheStore.get(cacheKey),
    phrase: randomPhrase,
    cacheKey
  };
}

/**
 * Store audio in cache
 */
function cacheAudio(key, audioBuffer) {
  audioCacheStore.set(key, audioBuffer);

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    audioCacheStore.delete(key);
  }, 3600000);
}

/**
 * Get audio from cache
 */
function getAudio(key) {
  return audioCacheStore.get(key);
}

module.exports = {
  preloadFillerPhrases,
  getRandomFillerAudio,
  cacheAudio,
  getAudio,
  FILLER_PHRASES
};
