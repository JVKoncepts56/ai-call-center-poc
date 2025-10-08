const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate speech from text using configured TTS provider
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice ID or name
 * @returns {Promise<Buffer>} Audio buffer (MP3 format)
 */
async function textToSpeech(text, voice) {
  const provider = process.env.TTS_PROVIDER || 'openai'; // Default to OpenAI

  try {
    if (provider === 'elevenlabs') {
      return await generateElevenLabsSpeech(text, voice);
    } else {
      return await generateOpenAISpeech(text, voice);
    }
  } catch (error) {
    console.error(`Error generating speech with ${provider}:`, error);
    console.error('Error details:', error.response?.data || error.message);

    // Fallback to OpenAI if ElevenLabs fails
    if (provider === 'elevenlabs') {
      console.warn('ElevenLabs failed, falling back to OpenAI TTS');
      const fallbackVoice = process.env.OPENAI_VOICE || 'alloy';
      return await generateOpenAISpeech(text, fallbackVoice);
    }

    throw new Error(`Failed to generate speech with ${provider}`);
  }
}

/**
 * Generate speech using OpenAI TTS
 */
async function generateOpenAISpeech(text, voice) {
  const speed = parseFloat(process.env.OPENAI_VOICE_SPEED) || 1.0;

  const mp3 = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: voice,
    input: text,
    speed: speed
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  return buffer;
}

/**
 * Generate speech using ElevenLabs TTS (Direct API call)
 */
async function generateElevenLabsSpeech(text, voiceIdParam) {
  const stability = parseFloat(process.env.ELEVENLABS_STABILITY) || 0.5;
  const similarityBoost = parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST) || 0.75;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1';

  // Use ELEVENLABS_VOICE_ID from env
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  console.log('ElevenLabs TTS Request (Direct API):', {
    voiceId,
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey?.length,
    apiKeyPrefix: apiKey?.substring(0, 10) + '...',
    textPreview: text.substring(0, 50),
    stability,
    similarityBoost,
    modelId
  });

  try {
    // Call ElevenLabs API directly with axios
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: modelId,
        voice_settings: {
          stability: stability,
          similarity_boost: similarityBoost
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    const audioBuffer = Buffer.from(response.data);

    console.log('ElevenLabs TTS Success:', {
      audioSize: audioBuffer.length,
      status: response.status
    });

    return audioBuffer;
  } catch (error) {
    console.error('ElevenLabs TTS Error Details:', {
      message: error.message,
      response: error.response?.data?.toString(),
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    throw error;
  }
}

module.exports = {
  textToSpeech
};
