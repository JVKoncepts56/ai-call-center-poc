const express = require('express');
const router = express.Router();
const { updateCallStatus } = require('../services/supabase');
const { validateTwilioSignature } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * POST /webhook/status
 * Handles Twilio call status updates
 */
router.post('/', async (req, res) => {
  try {
    // Validate Twilio signature
    const signature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!validateTwilioSignature(signature, url, req.body)) {
      logger.warn('Invalid Twilio signature on status webhook');
      return res.status(403).send('Forbidden');
    }

    const {
      CallSid,
      CallStatus,
      CallDuration,
      From,
      To,
      Direction,
      Timestamp
    } = req.body;

    logger.info('Call status update', {
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration
    });

    // Update call status in database
    const updates = {
      status: CallStatus,
      updated_at: new Date().toISOString()
    };

    // If call is completed, add duration
    if (CallStatus === 'completed' && CallDuration) {
      updates.duration = parseInt(CallDuration, 10);
    }

    await updateCallStatus(CallSid, updates);

    logger.info('Call status updated in database', { callSid: CallSid });

    // Respond with 200 OK
    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error in status webhook', { error: error.message });
    // Still respond with 200 to prevent Twilio retries
    res.status(200).send('OK');
  }
});

module.exports = router;
