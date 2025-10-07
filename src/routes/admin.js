const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { getCallLogs } = require('../services/supabase');
const logger = require('../utils/logger');

/**
 * POST /admin/knowledge-base
 * Upload or update knowledge base content
 */
router.post('/knowledge-base', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Content field is required and must be a string'
      });
    }

    const knowledgeBasePath = path.join(process.cwd(), 'knowledge-base.txt');

    // Write the new content to the knowledge base file
    await fs.writeFile(knowledgeBasePath, content, 'utf-8');

    logger.info('Knowledge base updated', {
      contentLength: content.length
    });

    res.status(200).json({
      success: true,
      message: 'Knowledge base updated successfully',
      contentLength: content.length
    });

  } catch (error) {
    logger.error('Error updating knowledge base', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update knowledge base'
    });
  }
});

/**
 * GET /admin/knowledge-base
 * Retrieve current knowledge base content
 */
router.get('/knowledge-base', async (req, res) => {
  try {
    const knowledgeBasePath = path.join(process.cwd(), 'knowledge-base.txt');
    const content = await fs.readFile(knowledgeBasePath, 'utf-8');

    res.status(200).json({
      success: true,
      content,
      contentLength: content.length
    });

  } catch (error) {
    logger.error('Error reading knowledge base', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to read knowledge base'
    });
  }
});

/**
 * GET /admin/calls
 * Retrieve call logs
 */
router.get('/calls', async (req, res) => {
  try {
    const { status, limit } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);

    const calls = await getCallLogs(filters);

    res.status(200).json({
      success: true,
      count: calls.length,
      calls
    });

  } catch (error) {
    logger.error('Error fetching call logs', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch call logs'
    });
  }
});

module.exports = router;
