import { v4 as uuidv4 } from 'uuid';
import { JobManager, JOB_STATUS } from '../../lib/jobs.js';
import FileDownloader from '../../utils/download.js';
import ProcessingService from '../../lib/processing-service.js';
import { put } from '@vercel/blob';
import fs from 'fs';

// Function to get the appropriate FFmpeg processor
async function getFFmpegProcessor() {
  if (process.env.VERCEL) {
    // Dynamic import for ES module
    const module = await import('../../lib/ffmpeg-wasm.js');
    return module.default;
  } else {
    const module = await import('../../lib/ffmpeg.js');
    return module.default;
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

async function processVideoAsync(jobId, videoUrl) {
  let downloadedFilePath = null;
  let audioFilePath = null;
  let FFmpegProcessor = null;

  try {
    console.log(`Starting processing for job ${jobId}`);
    
    // Update job status to processing
    JobManager.setJobStatus(jobId, JOB_STATUS.PROCESSING);

    // Get the appropriate FFmpeg processor
    FFmpegProcessor = await getFFmpegProcessor();

    // Step 1: Download video file
    console.log(`Downloading video for job ${jobId}`);
    JobManager.setJobProgress(jobId, 10);
    
    downloadedFilePath = await FileDownloader.downloadFile(
      videoUrl, 
      jobId, 
      (progress) => {
        // Download progress: 10-50%
        const adjustedProgress = 10 + (progress * 0.4);
        JobManager.setJobProgress(jobId, Math.round(adjustedProgress));
      }
    );

    console.log(`Video downloaded for job ${jobId}: ${downloadedFilePath}`);

    // Step 2: Validate video file
    console.log(`Validating video file for job ${jobId}`);
    JobManager.setJobProgress(jobId, 55);
    
    await FFmpegProcessor.validateVideoFile(downloadedFilePath);
    console.log(`Video file validated for job ${jobId}`);

    // Step 3: Extract audio
    console.log(`Extracting audio for job ${jobId}`);
    JobManager.setJobProgress(jobId, 60);
    
    audioFilePath = await FFmpegProcessor.processVideoToAudio(
      downloadedFilePath,
      jobId,
      (progress) => {
        // Audio extraction progress: 60-90%
        const adjustedProgress = 60 + (progress * 0.3);
        JobManager.setJobProgress(jobId, Math.round(adjustedProgress));
      }
    );

    console.log(`Audio extracted for job ${jobId}: ${audioFilePath}`);

    // Step 4: Upload to Vercel Blob
    console.log(`Uploading audio to blob storage for job ${jobId}`);
    JobManager.setJobProgress(jobId, 95);

    const audioBuffer = fs.readFileSync(audioFilePath);
    const fileName = `${jobId}.mp3`;
    
    const blob = await put(fileName, audioBuffer, {
      access: 'public',
      contentType: 'audio/mpeg'
    });

    console.log(`Audio uploaded to blob storage for job ${jobId}: ${blob.url}`);

    // Step 5: Complete job
    JobManager.setJobCompleted(jobId, blob.url);
    console.log(`Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    JobManager.setJobFailed(jobId, error);
  } finally {
    // Cleanup temporary files
    if (downloadedFilePath) {
      FileDownloader.cleanupFile(downloadedFilePath);
    }
    if (audioFilePath && FFmpegProcessor) {
      FFmpegProcessor.cleanupTempFile(audioFilePath);
    }
  }
}

// Helper function to validate environment variables
function validateEnvironment() {
  const requiredEnvVars = ['BLOB_READ_WRITE_TOKEN'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Note: Environment validation moved to runtime instead of module load
