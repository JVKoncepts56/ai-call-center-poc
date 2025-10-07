const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client only if credentials are provided
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY &&
    process.env.SUPABASE_URL !== 'your_supabase_url') {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  console.log('Supabase client initialized');
} else {
  console.warn('Supabase credentials not configured - database features disabled');
}

/**
 * Log call data to Supabase
 * @param {Object} callData - Call information
 * @returns {Promise<Object>} Inserted record
 */
async function logCall(callData) {
  if (!supabase) {
    console.log('Supabase not configured - skipping call log');
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .insert([
        {
          call_sid: callData.callSid,
          from_number: callData.from,
          to_number: callData.to,
          status: callData.status,
          duration: callData.duration || null,
          transcript: callData.transcript || null,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error logging call to Supabase:', error);
    return null;
  }
}

/**
 * Update call status
 * @param {string} callSid - Twilio call SID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated record
 */
async function updateCallStatus(callSid, updates) {
  if (!supabase) {
    console.log('Supabase not configured - skipping status update');
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .update(updates)
      .eq('call_sid', callSid)
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating call status:', error);
    return null;
  }
}

/**
 * Store conversation message
 * @param {Object} messageData - Message information
 * @returns {Promise<Object>} Inserted record
 */
async function storeMessage(messageData) {
  if (!supabase) {
    console.log('Supabase not configured - skipping message storage');
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert([
        {
          call_sid: messageData.callSid,
          role: messageData.role, // 'user' or 'assistant'
          content: messageData.content,
          timestamp: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error storing message:', error);
    return null;
  }
}

/**
 * Get conversation history for a call
 * @param {string} callSid - Twilio call SID
 * @returns {Promise<Array>} Array of messages
 */
async function getConversationHistory(callSid) {
  if (!supabase) {
    console.log('Supabase not configured - returning empty history');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('call_sid', callSid)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
}

/**
 * Get all call logs with optional filtering
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of call logs
 */
async function getCallLogs(filters = {}) {
  if (!supabase) {
    console.log('Supabase not configured - returning empty logs');
    return [];
  }
  try {
    let query = supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching call logs:', error);
    return [];
  }
}

module.exports = {
  logCall,
  updateCallStatus,
  storeMessage,
  getConversationHistory,
  getCallLogs,
  supabase
};
