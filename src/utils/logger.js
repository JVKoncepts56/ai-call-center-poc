/**
 * Simple logger utility
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaStr}`;
}

function error(message, meta = {}) {
  console.error(formatMessage(LOG_LEVELS.ERROR, message, meta));
}

function warn(message, meta = {}) {
  console.warn(formatMessage(LOG_LEVELS.WARN, message, meta));
}

function info(message, meta = {}) {
  console.log(formatMessage(LOG_LEVELS.INFO, message, meta));
}

function debug(message, meta = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.log(formatMessage(LOG_LEVELS.DEBUG, message, meta));
  }
}

module.exports = {
  error,
  warn,
  info,
  debug
};
