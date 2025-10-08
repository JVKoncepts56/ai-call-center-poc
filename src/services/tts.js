const OpenAI = require('openai');
const ElevenLabs = require('elevenlabs-node');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize ElevenLabs with API key
const voice = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY
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
 * Generate speech using ElevenLabs TTS
 */
async function generateElevenLabsSpeech(text, voiceId) {
  const stability = parseFloat(process.env.ELEVENLABS_STABILITY) || 0.5;
  const similarityBoost = parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST) || 0.75;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1';

  // Create a temporary file path (required by elevenlabs-node)
  const tempFileName = `/tmp/elevenlabs-${Date.now()}.mp3`;

  try {
    // Generate audio using elevenlabs-node API
    await voice.textToSpeech({
      fileName: tempFileName,
      textInput: text,
      voiceId: voiceId,
      stability: stability,
      similarityBoost: similarityBoost,
      modelId: modelId
    });

    // Read the generated file into a buffer
    const audioBuffer = fs.readFileSync(tempFileName);

    // Clean up the temp file
    fs.unlinkSync(tempFileName);

    return audioBuffer;
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempFileName)) {
      fs.unlinkSync(tempFileName);
    }
    throw error;
  }
}

module.exports = {
  textToSpeech
};
