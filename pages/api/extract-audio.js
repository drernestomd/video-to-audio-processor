const { v4: uuidv4 } = require('uuid');
const { JobManager, JOB_STATUS } = require('../../lib/jobs');
const FileDownloader = require('../../utils/download');
const ProcessingService = require('../../lib/processing-service');
const { put } = require('@vercel/blob');
const fs = require('fs');

// Function to get the appropriate FFmpeg processor
async function getFFmpegProcessor() {
  if (process.env.VERCEL) {
    // Dynamic import for ES module
    const module = await import('../../lib/ffmpeg-wasm');
    return module.default;
  } else {
    return require('../../lib/ffmpeg');
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

    // Determine processing method
    try {
      const processingResult = await processingServiceInstance.processJob(jobId, videoUrl, processingService);
      
      if (processingResult.useLocalProcessing) {
        // Use local Vercel WebAssembly processing
        console.log(`Using local processing for job ${jobId}`);
        processVideoAsync(jobId, videoUrl);
      } else {
        // Job submitted to external service
        console.log(`Job ${jobId} submitted to ${processingResult.serviceName}`);
        JobManager.updateJob(jobId, {
          processingService: processingResult.serviceType,
          externalProcessing: true,
          submittedAt: processingResult.submittedAt
        });
      }

      // Return job ID immediately with processing info
      res.status(202).json({
        success: true,
        jobId: jobId,
        status: JOB_STATUS.QUEUED,
        message: 'Video processing started. Use the job ID to check status.',
        statusUrl: `/api/status/${jobId}`,
        downloadUrl: `/api/download/${jobId}`,
        processingService: processingResult.serviceType,
        serviceName: processingResult.serviceName,
        externalProcessing: !processingResult.useLocalProcessing
      });

    } catch (processingError) {
      console.error(`Failed to submit job ${jobId}:`, processingError);
      
      // Fallback to local processing if external service fails
      if (processingService && processingService !== 'vercel') {
        console.log(`Falling back to local processing for job ${jobId}`);
        processVideoAsync(jobId, videoUrl);
        
        res.status(202).json({
          success: true,
          jobId: jobId,
          status: JOB_STATUS.QUEUED,
          message: 'Video processing started with fallback service. Use the job ID to check status.',
          statusUrl: `/api/status/${jobId}`,
          downloadUrl: `/api/download/${jobId}`,
          processingService: 'vercel',
          serviceName: 'Vercel WebAssembly (Fallback)',
          externalProcessing: false,
          fallback: true
        });
      } else {
        JobManager.setJobFailed(jobId, processingError);
        throw processingError;
      }
    }

  } catch (error) {
    console.error('Extract audio API error:', error);
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

// Validate environment on module load
try {
  validateEnvironment();
} catch (error) {
  console.warn('Environment validation warning:', error.message);
}
