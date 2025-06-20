import { JobManager } from '../../../lib/jobs.js';
import axios from 'axios';

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

    // Check job status
    if (job.status !== 'completed') {
      const statusMessages = {
        'queued': 'Job is still queued for processing',
        'processing': 'Job is currently being processed',
        'failed': 'Job failed to complete'
      };

      return res.status(409).json({ 
        error: 'Job not ready',
        message: statusMessages[job.status] || 'Job is not ready for download',
        status: job.status,
        progress: job.progress,
        statusUrl: `/api/status/${jobId}`,
        suggestion: job.status === 'failed' 
          ? 'Please retry the conversion process'
          : 'Please wait for the job to complete and try again'
      });
    }

    // Check if audio URL exists
    if (!job.audioUrl) {
      return res.status(500).json({ 
        error: 'Audio file not available',
        message: 'Job completed but audio file URL is missing',
        suggestion: 'Please contact support or retry the conversion'
      });
    }

    try {
      // Stream the audio file from blob storage
      console.log(`Downloading audio file for job ${jobId} from: ${job.audioUrl}`);
      
      const response = await axios({
        method: 'GET',
        url: job.audioUrl,
        responseType: 'stream',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'User-Agent': 'video-to-audio-api/1.0.0'
        }
      });

      // Set appropriate headers for audio download
      const fileName = `audio_${jobId}.mp3`;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      // Add custom headers for API information
      res.setHeader('X-Job-ID', jobId);
      res.setHeader('X-Original-Video-URL', job.videoUrl);
      res.setHeader('X-Processed-At', job.updatedAt);

      // If content-length is available, set it
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      // Pipe the audio stream to the response
      response.data.pipe(res);

      // Handle stream errors
      response.data.on('error', (error) => {
        console.error(`Stream error for job ${jobId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Download failed',
            message: 'Failed to stream audio file'
          });
        }
      });

      // Log successful download
      response.data.on('end', () => {
        console.log(`Audio file successfully downloaded for job ${jobId}`);
      });

    } catch (downloadError) {
      console.error(`Failed to download audio for job ${jobId}:`, downloadError);
      
      // Handle different types of download errors
      if (downloadError.response) {
        const status = downloadError.response.status;
        if (status === 404) {
          return res.status(404).json({ 
            error: 'Audio file not found',
            message: 'The audio file is no longer available',
            suggestion: 'Please retry the conversion process'
          });
        } else if (status === 403) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'Unable to access the audio file',
            suggestion: 'Please contact support'
          });
        }
      }

      return res.status(500).json({ 
        error: 'Download failed',
        message: 'Failed to retrieve audio file from storage',
        suggestion: 'Please try again or contact support if the problem persists'
      });
    }

  } catch (error) {
    console.error('Download API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the download request'
    });
  }
}

// Helper function to validate audio URL
function isValidAudioUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' && urlObj.hostname.includes('vercel');
  } catch (error) {
    return false;
  }
}

// Helper function to get file size from URL
async function getFileSize(url) {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.headers['content-length'] || null;
  } catch (error) {
    console.warn('Failed to get file size:', error.message);
    return null;
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return 'Unknown size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
