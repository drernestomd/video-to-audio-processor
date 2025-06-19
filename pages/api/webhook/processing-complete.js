const { JobManager } = require('../../../lib/jobs');
const ProcessingService = require('../../../lib/processing-service');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const processingService = new ProcessingService();
    
    // Validate webhook signature for security
    const signature = req.headers['x-signature'];
    if (signature && !processingService.validateWebhook(signature, req.body)) {
      console.warn('Invalid webhook signature received');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    }

    const { 
      jobId, 
      status, 
      audioUrl, 
      error, 
      progress = 100,
      processingTime,
      serviceType,
      metadata 
    } = req.body;

    // Validate required fields
    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing job ID',
        message: 'jobId is required in webhook payload'
      });
    }

    if (!status) {
      return res.status(400).json({ 
        error: 'Missing status',
        message: 'status is required in webhook payload'
      });
    }

    // Get the job
    const job = JobManager.getJob(jobId);
    if (!job) {
      console.warn(`Webhook received for unknown job: ${jobId}`);
      return res.status(404).json({ 
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }

    console.log(`Webhook received for job ${jobId}: ${status}`);

    // Update job based on status
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        if (!audioUrl) {
          console.error(`Completed job ${jobId} missing audioUrl`);
          JobManager.setJobFailed(jobId, 'Processing completed but no audio URL provided');
        } else {
          JobManager.setJobCompleted(jobId, audioUrl);
          
          // Add processing metadata
          if (metadata || processingTime || serviceType) {
            JobManager.updateJob(jobId, {
              processingTime,
              serviceType,
              metadata,
              externalProcessing: true
            });
          }
          
          console.log(`Job ${jobId} completed successfully via ${serviceType || 'external service'}`);
        }
        break;

      case 'failed':
      case 'error':
        const errorMessage = error || 'External processing failed';
        JobManager.setJobFailed(jobId, errorMessage);
        console.log(`Job ${jobId} failed: ${errorMessage}`);
        break;

      case 'processing':
      case 'in_progress':
        JobManager.setJobProgress(jobId, progress);
        JobManager.setJobStatus(jobId, 'processing');
        console.log(`Job ${jobId} progress update: ${progress}%`);
        break;

      default:
        console.warn(`Unknown status received for job ${jobId}: ${status}`);
        return res.status(400).json({ 
          error: 'Invalid status',
          message: `Unknown status: ${status}`
        });
    }

    // Return success response
    res.status(200).json({
      success: true,
      jobId,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
}

// Disable body parsing to handle raw webhook data if needed
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
