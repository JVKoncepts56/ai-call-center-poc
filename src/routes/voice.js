const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { generateResponse } = require('../services/openai');
const { logCall, storeMessage, getConversationHistory } = require('../services/supabase');
const { validateTwilioSignature, sanitizeInput } = require('../utils/validators');
const { generateAndCacheAudio } = require('./audio');
const { getRandomFillerAudio } = require('../utils/audioCache');
const logger = require('../utils/logger');

const VoiceResponse = twilio.twiml.VoiceResponse;

// OpenAI voice from environment variable (required)
const OPENAI_VOICE = process.env.OPENAI_VOICE;

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
      // Gather speech input - must be BEFORE play/say
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhook/voice',
        method: 'POST',
        timeout: 5,
        speechTimeout: 'auto',
        language: 'en-US',
        hints: 'telemedicine, legal, Workforce Shield, medical, attorney, doctor'
      });

      // First interaction - greet the caller with ElevenLabs voice
      const greetingText = 'Welcome to Workforce Shield, Virtual Care and Expert Counsel, Anytime, Any Day. Are you needing help with legal or medical issues?';
      const audioKey = await generateAndCacheAudio(greetingText, OPENAI_VOICE);
      const audioUrl = `${req.protocol}://${req.get('host')}/audio/${audioKey}`;

      gather.play(audioUrl);

    } else {
      // Process the user's speech
      const userInput = sanitizeInput(speechResult);
      logger.info('User speech input', { callSid, userInput });

      // Get conversation history to check if this is first user message
      const history = await getConversationHistory(callSid);
      const isFirstMessage = history.length === 0;

      // Check if user is asking for legal or medical help (only on first message)
      let bumperMessage = null;
      if (isFirstMessage) {
        const lowerInput = userInput.toLowerCase();
        const legalKeywords = ['legal', 'lawyer', 'attorney', 'law', 'court', 'lawsuit', 'divorce', 'dwi', 'accident'];
        const medicalKeywords = ['medical', 'health', 'doctor', 'sick', 'medicine', 'telemedicine', 'physician', 'symptom'];

        const hasLegalKeyword = legalKeywords.some(keyword => lowerInput.includes(keyword));
        const hasMedicalKeyword = medicalKeywords.some(keyword => lowerInput.includes(keyword));

        if (hasLegalKeyword && !hasMedicalKeyword) {
          bumperMessage = 'Get the legal support you need at a discounted rate with professional advice and care at your fingertips. How can I help you?';
        } else if (hasMedicalKeyword && !hasLegalKeyword) {
          bumperMessage = 'We\'re dedicated to providing you with top-quality telemedicine services starting with the medical kit we sent you with a blood pressure monitor, thermometer or covid tests. You can connect with our Certified Medical Team 24/7 with a simple phone call. How can I help you?';
        }
      }

      // If we have a bumper message, play it and continue gathering
      if (bumperMessage) {
        // Store user message
        await storeMessage({ callSid, role: 'user', content: userInput });

        // Store bumper as assistant message
        await storeMessage({
          callSid,
          role: 'assistant',
          content: bumperMessage
        });

        // Play the bumper message
        const bumperAudioKey = await generateAndCacheAudio(bumperMessage, OPENAI_VOICE);
        const bumperAudioUrl = `${req.protocol}://${req.get('host')}/audio/${bumperAudioKey}`;
        twiml.play(bumperAudioUrl);

        logger.info('Played department bumper', { callSid, type: bumperMessage.includes('legal') ? 'legal' : 'medical' });

        // Continue gathering input after bumper
        const gather = twiml.gather({
          input: 'speech',
          action: '/webhook/voice',
          method: 'POST',
          timeout: 5,
          speechTimeout: 'auto',
          language: 'en-US',
          hints: 'telemedicine, legal, Workforce Shield, medical, attorney, doctor, yes, no'
        });

        // Don't add follow-up text after bumper - let them respond directly
      } else {
        // Normal flow: Use pre-cached filler for INSTANT acknowledgment
        const { cacheKey: fillerKey } = getRandomFillerAudio(OPENAI_VOICE);
        const fillerAudioUrl = `${req.protocol}://${req.get('host')}/audio/${fillerKey}`;

        // Play instant filler acknowledgment
        twiml.play(fillerAudioUrl);

        // Store user message
        await storeMessage({ callSid, role: 'user', content: userInput });

        // Get conversation history and generate AI response
        const conversationHistory = history.map(msg => ({ role: msg.role, content: msg.content }));
        const aiResponse = await generateResponse(userInput, conversationHistory);

        logger.info('AI response generated', { callSid, response: aiResponse });

        // Store AI message
        await storeMessage({
          callSid,
          role: 'assistant',
          content: aiResponse
        });

        // Generate and play the actual response
        const responseAudioKey = await generateAndCacheAudio(aiResponse, OPENAI_VOICE);
        const responseAudioUrl = `${req.protocol}://${req.get('host')}/audio/${responseAudioKey}`;
        twiml.play(responseAudioUrl);

        // Continue gathering input with better settings
        const gather = twiml.gather({
          input: 'speech',
          action: '/webhook/voice',
          method: 'POST',
          timeout: 5,
          speechTimeout: 'auto',
          language: 'en-US',
          hints: 'telemedicine, legal, Workforce Shield, medical, attorney, doctor, yes, no'
        });

        // If no input, ask if they need anything else
        const followUpText = 'Is there anything else I can help you with?';
        const followUpAudioKey = await generateAndCacheAudio(followUpText, OPENAI_VOICE);
        const followUpAudioUrl = `${req.protocol}://${req.get('host')}/audio/${followUpAudioKey}`;
        gather.play(followUpAudioUrl);
      }
    }

    const twimlResponse = twiml.toString();
    const responseSize = Buffer.byteLength(twimlResponse, 'utf8');

    logger.info('TwiML response generated', {
      callSid,
      sizeBytes: responseSize,
      sizeKB: (responseSize / 1024).toFixed(2)
    });

    if (responseSize > 65536) {
      logger.error('TwiML response exceeds 64KB limit', {
        callSid,
        sizeBytes: responseSize,
        twimlPreview: twimlResponse.substring(0, 500)
      });
    }

    res.type('text/xml');
    res.send(twimlResponse);

  } catch (error) {
    logger.error('Error in voice webhook', {
      error: error.message,
      stack: error.stack,
      openaiVoice: OPENAI_VOICE
    });

    const twiml = new VoiceResponse();

    // Always use OpenAI voice for error messages
    try {
      const errorText = 'I apologize, but I encountered an error. Please try again later.';
      const errorAudioKey = await generateAndCacheAudio(errorText, OPENAI_VOICE);
      const errorAudioUrl = `${req.protocol}://${req.get('host')}/audio/${errorAudioKey}`;
      twiml.play(errorAudioUrl);
    } catch (innerError) {
      logger.error('Failed to generate error audio with OpenAI', {
        error: innerError.message,
        voice: OPENAI_VOICE
      });
      // If OpenAI fails, just hang up
      twiml.say('System error. Goodbye.');
    }
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

module.exports = router;
