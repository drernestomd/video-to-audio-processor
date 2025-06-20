import { v4 as uuidv4 } from 'uuid';
import { JobManager, JOB_STATUS } from '../../lib/jobs.js';
import FileDownloader from '../../utils/download.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('Debug: Starting extract-audio handler');
    const { videoUrl, processingService } = req.body;

    // Validate input
    if (!videoUrl) {
      return res.status(400).json({ 
        error: 'Missing video URL',
        message: 'Please provide a videoUrl in the request body'
      });
    }
    console.log('Debug: videoUrl provided:', videoUrl);

    if (!FileDownloader.isValidUrl(videoUrl)) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please provide a valid video URL'
      });
    }
    console.log('Debug: URL is valid');

    if (!FileDownloader.isSupportedVideoUrl(videoUrl)) {
      return res.status(400).json({ 
        error: 'Unsupported video source',
        message: 'Please provide a URL from a supported video platform (Google Drive, YouTube, Vimeo, etc.)'
      });
    }
    console.log('Debug: URL is supported');

    // Test ProcessingService import
    console.log('Debug: About to import ProcessingService');
    try {
      const ProcessingService = (await import('../../lib/processing-service.js')).default;
      console.log('Debug: ProcessingService imported successfully');
      
      const processingServiceInstance = new ProcessingService();
      console.log('Debug: ProcessingService instance created');
      
      // Generate job ID and create job
      const jobId = uuidv4();
      console.log('Debug: Generated job ID:', jobId);
      
      const job = JobManager.createJob(jobId, videoUrl);
      console.log('Debug: Job created:', job);

      // Test processJob method
      console.log('Debug: About to call processJob');
      const processingResult = await processingServiceInstance.processJob(jobId, videoUrl, processingService);
      console.log('Debug: ProcessJob result:', processingResult);

      // Return success response
      res.status(202).json({
        success: true,
        debug: true,
        jobId: jobId,
        status: JOB_STATUS.QUEUED,
        message: 'Debug: All steps completed successfully',
        processingResult: processingResult
      });

    } catch (importError) {
      console.error('Debug: ProcessingService import/creation error:', importError);
      return res.status(500).json({
        error: 'ProcessingService error',
        message: importError.message,
        stack: importError.stack
      });
    }

  } catch (error) {
    console.error('Debug: Extract audio API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack,
      debug: true
    });
  }
}
