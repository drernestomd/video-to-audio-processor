const { v4: uuidv4 } = require('uuid');
const { JobManager, JOB_STATUS } = require('../../lib/jobs.js');
const FileDownloader = require('../../utils/download.js');
const ProcessingService = require('../../lib/processing-service.js');
const { put } = require('@vercel/blob');
const fs = require('fs');

// Function to get the appropriate FFmpeg processor
async function getFFmpegProcessor() {
  if (process.env.VERCEL) {
    // Dynamic require for CommonJS module
    return require('../../lib/ffmpeg-wasm.js');
  } else {
    return require('../../lib/ffmpeg.js');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const { videoUrl, processingService } = req.body;

    // Validate input
    if (!videoUrl) {
      return res.status(400).json({ 
        error: 'Missing video URL',
        message: 'Please provide a videoUrl in the request body'
      });
    }

    if (!FileDownloader.isValidUrl(videoUrl)) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please provide a valid video URL'
      });
    }

    if (!FileDownloader.isSupportedVideoUrl(videoUrl)) {
      return res.status(400).json({ 
        error: 'Unsupported video source',
        message: 'Please provide a URL from a supported video platform (Google Drive, YouTube, Vimeo, etc.)'
      });
    }

    // Initialize processing service
    const processingServiceInstance = new ProcessingService();

    // Generate job ID and create job
    const jobId = uuidv4();
    const job = JobManager.createJob(jobId, videoUrl);

    console.log(`Created job ${jobId} for video: ${videoUrl}`);

    // RAILWAY ONLY - NO FALLBACKS, NO LOCAL PROCESSING
    const processingResult = await processingServiceInstance.processJob(jobId, videoUrl, processingService);
    
    // Verify it's using Railway
    if (processingResult.serviceType !== 'railway') {
      throw new Error('INVALID: Only Railway processing is allowed');
    }
    
    // Update job status
    console.log(`Job ${jobId} submitted to Railway: ${processingResult.serviceName}`);
    JobManager.updateJob(jobId, {
      processingService: 'railway',
      externalProcessing: true,
      submittedAt: processingResult.submittedAt
    });

    // Return job ID immediately
    res.status(202).json({
      success: true,
      jobId: jobId,
      status: JOB_STATUS.QUEUED,
      message: 'Video processing started on Railway (no local fallback).',
      statusUrl: `/api/status/${jobId}`,
      downloadUrl: `/api/download/${jobId}`,
      processingService: 'railway',
      serviceName: processingResult.serviceName,
      externalProcessing: true,
      railwayOnly: true
    });

  } catch (error) {
    console.error('Extract audio API error:', error);
    
    // Check if it's a Railway configuration error
    if (error.message && error.message.includes('Railway processing service is required but not configured')) {
      return res.status(503).json({
        error: 'Service configuration error',
        message: 'Railway processing service is not configured.',
        details: 'RAILWAY_PROCESSING_URL environment variable is required but not set.',
        statusCode: 503
      });
    }
    
    // Check if it's a Railway connection error
    if (error.message && (error.message.includes('Failed to submit job to Railway') || error.message.includes('Railway'))) {
      return res.status(503).json({
        error: 'Processing service unavailable',
        message: 'Unable to connect to Railway processing service.',
        details: 'The Railway processing service is not responding. This may be due to network connectivity, service downtime, or authentication issues.',
        alternatives: {
          checkStatus: 'Check Railway service status at your Railway dashboard',
          retryLater: 'The service may become available again. Please try again in a few minutes.',
          manualProcessing: 'You can manually convert your video using online tools like CloudConvert, Convertio, or local software like VLC Media Player.'
        },
        retryAfter: 300, // 5 minutes
        statusCode: 503
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request'
    });
  }
}

// LOCAL PROCESSING REMOVED - RAILWAY ONLY

// Helper function to validate environment variables
function validateEnvironment() {
  const requiredEnvVars = ['BLOB_READ_WRITE_TOKEN'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Note: Environment validation moved to runtime instead of module load
