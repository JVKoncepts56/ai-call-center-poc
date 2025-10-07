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

    const systemPrompt = `You are a helpful customer service AI assistant for a call center.
Use the following knowledge base to answer customer questions accurately and professionally.
If you don't know the answer based on the knowledge base, politely let the customer know and offer to transfer them to a human agent.

Knowledge Base:
${knowledgeBase}

Guidelines:
- Be concise and friendly
- Provide accurate information based on the knowledge base
- If uncertain, offer to transfer to a human agent
- Keep responses brief for phone conversations`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150
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
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice, // Options: alloy, echo, fable, onyx, nova, shimmer
      input: text,
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
