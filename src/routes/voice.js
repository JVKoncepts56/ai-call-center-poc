const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { generateResponse } = require('../services/openai');
const { logCall, storeMessage, getConversationHistory } = require('../services/supabase');
const { validateTwilioSignature, sanitizeInput } = require('../utils/validators');
const { generateAndCacheAudio } = require('./audio');
const logger = require('../utils/logger');

const VoiceResponse = twilio.twiml.VoiceResponse;

// OpenAI voice to use (options: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse)
const OPENAI_VOICE = process.env.OPENAI_VOICE || 'sage';

/**
 * POST /webhook/voice
 * Handles incoming Twilio voice calls
 */
router.post('/', async (req, res) => {
  try {
    // Validate Twilio signature
    const signature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!validateTwilioSignature(signature, url, req.body)) {
      logger.warn('Invalid Twilio signature');
      return res.status(403).send('Forbidden');
    }

    const callSid = req.body.CallSid;
    const from = req.body.From;
    const to = req.body.To;
    const speechResult = req.body.SpeechResult || '';

    logger.info('Incoming call', { callSid, from, to });

    // Log the call to database
    if (!speechResult) {
      await logCall({
        callSid,
        from,
        to,
        status: 'in-progress'
      });
    }

    const twiml = new VoiceResponse();

    // Initial greeting or process speech input
    if (!speechResult) {
      // First interaction - greet the caller with OpenAI voice
      const greetingText = 'Thank you for calling Workforce Shield. How can I help you today?';
      const audioKey = await generateAndCacheAudio(greetingText, OPENAI_VOICE);
      const audioUrl = `${req.protocol}://${req.get('host')}/audio/${audioKey}`;

      twiml.play(audioUrl);

      // Gather speech input
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhook/voice',
        method: 'POST',
        timeout: 3,
        speechTimeout: 'auto',
        language: 'en-US'
      });

    } else {
      // Process the user's speech
      const userInput = sanitizeInput(speechResult);
      logger.info('User speech input', { callSid, userInput });

      // Store user message
      await storeMessage({
        callSid,
        role: 'user',
        content: userInput
      });

      // Get conversation history
      const history = await getConversationHistory(callSid);
      const conversationHistory = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Generate AI response
      const aiResponse = await generateResponse(userInput, conversationHistory);
      logger.info('AI response generated', { callSid, response: aiResponse });

      // Store AI message
      await storeMessage({
        callSid,
        role: 'assistant',
        content: aiResponse
      });

      // Speak the response with OpenAI voice
      const responseAudioKey = await generateAndCacheAudio(aiResponse, OPENAI_VOICE);
      const responseAudioUrl = `${req.protocol}://${req.get('host')}/audio/${responseAudioKey}`;
      twiml.play(responseAudioUrl);

      // Continue gathering input
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhook/voice',
        method: 'POST',
        timeout: 3,
        speechTimeout: 'auto',
        language: 'en-US'
      });

      // If no input, ask if they need anything else
      const followUpText = 'Is there anything else I can help you with?';
      const followUpAudioKey = await generateAndCacheAudio(followUpText, OPENAI_VOICE);
      const followUpAudioUrl = `${req.protocol}://${req.get('host')}/audio/${followUpAudioKey}`;
      twiml.play(followUpAudioUrl);

      // Redirect to gather more input
      twiml.redirect('/webhook/voice');
    }

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    logger.error('Error in voice webhook', { error: error.message });

    const twiml = new VoiceResponse();
    // Fallback to Twilio voice if OpenAI fails
    twiml.say({
      voice: 'Polly.Ruth',
      language: 'en-US'
    }, 'I apologize, but I encountered an error. Please try again later.');
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

module.exports = router;
