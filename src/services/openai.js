const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Load knowledge base from file
 */
async function loadKnowledgeBase() {
  try {
    const knowledgeBasePath = path.join(process.cwd(), 'knowledge-base.txt');
    const content = await fs.readFile(knowledgeBasePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    return '';
  }
}

/**
 * Generate AI response using OpenAI Chat Completions
 * @param {string} userMessage - The user's message/question
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @returns {Promise<string>} AI-generated response
 */
async function generateResponse(userMessage, conversationHistory = []) {
  try {
    const knowledgeBase = await loadKnowledgeBase();

    const systemPrompt = `You are a helpful customer service AI assistant for Workforce Shield call center.

CRITICAL RULES:
- Your responses MUST be spoken in 20 seconds or less (maximum 4-5 sentences)
- Answer ONLY what was asked - be direct and helpful
- Use ONLY the knowledge base below to answer
- If you don't know, say "I don't have that information, but I can connect you with someone who does"
- Be conversational but concise

Knowledge Base:
${knowledgeBase}

Example good responses:
- "We're available 24/7, every day of the week. You can reach us anytime at 888-744-3537 for immediate assistance."
- "Yes, our telemedicine service connects you directly with certified doctors by phone. There's no appointment needed, and you can call whenever you need medical advice."
- "Members receive discounted legal rates for a wide range of services. Would you like me to connect you with an attorney to discuss your specific situation?"`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: messages,
      temperature: 0.7,
      max_tokens: 160,  // 20-second responses (about 120 words)
      top_p: 0.9,       // Slightly more focused responses for speed
      frequency_penalty: 0.3,  // Reduce repetition
      presence_penalty: 0.3    // Encourage varied responses
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating OpenAI response:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Generate speech from text using OpenAI TTS
 * @param {string} text - Text to convert to speech
 * @returns {Promise<Buffer>} Audio buffer
 */
async function textToSpeech(text, voice = 'nova') {
  try {
    // Get speed from environment variable, default to 1.0 (normal)
    const speed = parseFloat(process.env.OPENAI_VOICE_SPEED) || 1.0;

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd', // HD quality for better, more natural sound
      voice: voice, // Options: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse
      input: text,
      speed: speed // Range: 0.25 to 4.0 (1.0 = normal, 1.1 = 10% faster, 0.9 = 10% slower)
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw new Error('Failed to generate speech');
  }
}

/**
 * Transcribe audio to text using OpenAI Whisper
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} filename - Filename for the audio
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(audioBuffer, filename = 'audio.mp3') {
  try {
    const file = new File([audioBuffer], filename, { type: 'audio/mpeg' });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio');
  }
}

module.exports = {
  generateResponse,
  textToSpeech,
  transcribeAudio,
  loadKnowledgeBase
};
