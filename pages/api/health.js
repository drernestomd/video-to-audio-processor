import ProcessingService from '../../lib/processing-service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  try {
    // Basic health checks
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    // Check environment variables
    const envChecks = {
      blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      isVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
      railwayUrl: !!process.env.RAILWAY_PROCESSING_URL,
      renderUrl: !!process.env.RENDER_PROCESSING_URL,
      webhookSecret: !!process.env.WEBHOOK_SECRET
    };

    // Check FFmpeg availability
    let ffmpegStatus = 'unknown';
    try {
      if (process.env.VERCEL) {
        ffmpegStatus = 'webassembly';
      } else {
        ffmpegStatus = 'native';
      }
    } catch (error) {
      ffmpegStatus = 'unavailable';
    }

    // Check processing services
    const processingService = new ProcessingService();
    const availableServices = processingService.getAvailableServices();
    const hasExternalProcessing = processingService.hasExternalProcessing();

    const response = {
      ...healthStatus,
      checks: {
        environment: envChecks,
        ffmpeg: ffmpegStatus,
        storage: envChecks.blobToken ? 'configured' : 'missing',
        externalProcessing: hasExternalProcessing
      },
      processingServices: {
        available: availableServices,
        external: hasExternalProcessing,
        default: processingService.getBestService().type
      },
      endpoints: {
        extract: '/api/extract-audio',
        status: '/api/status/[jobId]',
        download: '/api/download/[jobId]',
        webhook: '/api/webhook/processing-complete'
      }
    };

    // Return appropriate status code
    const allChecksPass = envChecks.blobToken && ffmpegStatus !== 'unavailable';
    const statusCode = allChecksPass ? 200 : 503;

    res.status(statusCode).json(response);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    });
  }
}
