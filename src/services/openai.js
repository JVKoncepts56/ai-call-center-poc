const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory cache for knowledge base
let knowledgeBaseCache = null;
let knowledgeBaseCacheTime = null;

/**
 * Load knowledge base from file with caching
 */
async function loadKnowledgeBase() {
  // Return cached version if available (cache for 1 hour)
  const cacheMaxAge = 3600000; // 1 hour in milliseconds
  const now = Date.now();

  if (knowledgeBaseCache && knowledgeBaseCacheTime && (now - knowledgeBaseCacheTime) < cacheMaxAge) {
    return knowledgeBaseCache;
  }

  // Load from disk and cache
  try {
    const knowledgeBasePath = path.join(process.cwd(), 'knowledge-base.txt');
    const content = await fs.readFile(knowledgeBasePath, 'utf-8');

    knowledgeBaseCache = content;
    knowledgeBaseCacheTime = now;

    console.log('✅ Knowledge base loaded and cached');
    return content;
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    // Return cached version even if expired, better than nothing
    return knowledgeBaseCache || '';
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

    const systemPrompt = `You are Dora, a helpful customer service AI assistant for Workforce Shield call center.

YOUR IDENTITY:
- Your name is Dora
- When asked your name, say "I'm Dora" or "My name is Dora"
- You work for Workforce Shield helping with medical and legal support
- Be friendly and personable

CRITICAL RULES:
- Your responses MUST be spoken in 15 seconds or less (maximum 3-4 sentences)
- Answer ONLY what was asked - be direct and helpful
- Use ONLY the knowledge base below to answer
- If you don't know, say "I don't have that information, but I can connect you with someone who does"
- Be conversational but concise

NATURAL SPEECH PATTERNS (VERY IMPORTANT):
- Use commas and periods for natural pauses and breathing room
- Add filler words liberally: "um", "uh", "you know", "actually", "so", "well", "I mean", "like"
- Use ellipses (...) for longer thinking pauses: "Let me see... um... yes, we can help"
- Use double ellipses for even longer pauses: "Hmm...... that's a great question"
- Start responses with conversational lead-ins: "Oh!", "Right!", "Okay so", "Well..."
- Add verbal acknowledgments: "I see", "Got it", "Sure thing", "Absolutely"
- Break up sentences naturally - don't be too formal or scripted
- It's okay to sound like you're thinking or processing
- Example: "Well... um, so we're available, you know, 24/7 for both medical and... uh... legal support"

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
      max_tokens: 120,  // 15-second responses (about 90 words)
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
 * Generate speech from text using configured TTS provider
 * Now uses the centralized TTS service (supports OpenAI and ElevenLabs)
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice ID or name
 * @returns {Promise<Buffer>} Audio buffer
 */
async function textToSpeech(text, voice) {
  const { textToSpeech: ttsGenerate } = require('./tts');
  return await ttsGenerate(text, voice);
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

/**
 * Clear knowledge base cache (useful for forcing reload)
 */
function clearKnowledgeBaseCache() {
  knowledgeBaseCache = null;
  knowledgeBaseCacheTime = null;
  console.log('Knowledge base cache cleared');
}

module.exports = {
  generateResponse,
  textToSpeech,
  transcribeAudio,
  loadKnowledgeBase,
  clearKnowledgeBaseCache
};
