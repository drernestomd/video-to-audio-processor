import { JobManager } from '../../../lib/jobs.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  try {
    const { jobId } = req.query;

    // Validate job ID
    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing job ID',
        message: 'Job ID is required in the URL path'
      });
    }

    if (typeof jobId !== 'string' || jobId.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid job ID',
        message: 'Job ID must be a valid string'
      });
    }

    // Get job from manager
    const job = JobManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`,
        suggestion: 'Please check the job ID and try again'
      });
    }

    // Prepare response based on job status
    const response = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      videoUrl: job.videoUrl
    };

    // Add status-specific information
    switch (job.status) {
      case 'queued':
        response.message = 'Job is queued and waiting to be processed';
        response.estimatedWaitTime = 'Less than 1 minute';
        break;

      case 'processing':
        response.message = 'Job is currently being processed';
        response.currentStep = getCurrentStep(job.progress);
        if (job.progress > 0) {
          response.progressMessage = getProgressMessage(job.progress);
        }
        break;

      case 'completed':
        response.message = 'Job completed successfully';
        response.audioUrl = job.audioUrl;
        response.downloadUrl = `/api/download/${jobId}`;
        response.completedAt = job.updatedAt;
        break;

      case 'failed':
        response.message = 'Job failed to complete';
        response.error = job.error;
        response.failedAt = job.updatedAt;
        response.retryUrl = '/api/extract-audio';
        break;

      default:
        response.message = 'Unknown job status';
    }

    // Set appropriate HTTP status code
    let statusCode = 200;
    if (job.status === 'failed') {
      statusCode = 422; // Unprocessable Entity
    } else if (job.status === 'processing' || job.status === 'queued') {
      statusCode = 202; // Accepted (still processing)
    }

    res.status(statusCode).json(response);

  } catch (error) {
    console.error('Status API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred while checking job status'
    });
  }
}

function getCurrentStep(progress) {
  if (progress < 10) return 'Initializing';
  if (progress < 50) return 'Downloading video';
  if (progress < 60) return 'Validating video file';
  if (progress < 90) return 'Extracting audio';
  if (progress < 100) return 'Uploading audio file';
  return 'Finalizing';
}

function getProgressMessage(progress) {
  if (progress < 10) return 'Preparing to download video...';
  if (progress < 50) return `Downloading video... ${progress}%`;
  if (progress < 60) return 'Checking video file format...';
  if (progress < 90) return `Converting video to audio... ${progress}%`;
  if (progress < 100) return 'Saving audio file...';
  return 'Processing complete!';
}

// Helper function to calculate estimated completion time
function getEstimatedCompletionTime(progress, createdAt) {
  if (progress <= 0) return null;
  
  const now = new Date();
  const startTime = new Date(createdAt);
  const elapsedTime = now - startTime;
  const estimatedTotalTime = (elapsedTime / progress) * 100;
  const remainingTime = estimatedTotalTime - elapsedTime;
  
  if (remainingTime <= 0) return 'Almost done';
  
  const minutes = Math.ceil(remainingTime / (1000 * 60));
  if (minutes <= 1) return 'Less than 1 minute';
  if (minutes <= 5) return `About ${minutes} minutes`;
  return 'A few more minutes';
}

// Add estimated completion time to processing jobs
function addEstimatedTime(response, job) {
  if (job.status === 'processing' && job.progress > 0) {
    response.estimatedCompletion = getEstimatedCompletionTime(job.progress, job.createdAt);
  }
  return response;
}
