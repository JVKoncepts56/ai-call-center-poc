/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid
 */
function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber) return false;
  // Basic validation for E.164 format
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Validate Twilio request signature
 * @param {string} signature - X-Twilio-Signature header
 * @param {string} url - Full URL of the webhook
 * @param {Object} params - Request parameters
 * @returns {boolean} True if valid
 */
function validateTwilioSignature(signature, url, params) {
  const twilio = require('twilio');
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    console.warn('TWILIO_AUTH_TOKEN not set, skipping signature validation');
    return true; // In development, allow requests
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Sanitize user input
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input) return '';
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate environment variables
 * @returns {Object} Validation result
 */
function validateEnvVariables() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing
  };
}

module.exports = {
  validatePhoneNumber,
  validateTwilioSignature,
  sanitizeInput,
  validateEnvVariables
};
