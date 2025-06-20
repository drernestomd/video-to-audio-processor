// Main API endpoint for video processing with basic validation and logging
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported' 
    });
  }

  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Basic request validation
  const { jobId, videoUrl, webhookUrl, userId } = req.body;
  
  if (!jobId || !videoUrl || !webhookUrl) {
    console.log(`[${requestId}] Validation failed: Missing required fields`);
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['jobId', 'videoUrl', 'webhookUrl'],
      received: Object.keys(req.body)
    });
  }

  // Validate URLs
  try {
    new URL(videoUrl);
    new URL(webhookUrl);
  } catch (error) {
    console.log(`[${requestId}] Validation failed: Invalid URL format`);
    return res.status(400).json({
      error: 'Invalid URL format',
      message: 'videoUrl and webhookUrl must be valid URLs'
    });
  }

  // Log the request
  console.log(`[${requestId}] Processing request:`, {
    jobId,
    videoUrl: videoUrl.substring(0, 50) + '...',
    webhookUrl: webhookUrl.substring(0, 50) + '...',
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString()
  });

  try {
    // Prepare the request for Railway
    const railwayPayload = {
      jobId,
      videoUrl,
      webhookUrl,
      callbackHeaders: {
        'X-Request-ID': requestId,
        'X-User-ID': userId || 'anonymous',
        'X-Processed-By': 'vercel-api'
      }
    };

    // Make the Railway request
    const railwayUrl = process.env.RAILWAY_PROCESSING_URL || 'https://video-processor-final-production.up.railway.app';
    
    const response = await fetch(`${railwayUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PROCESSING_SERVICE_TOKEN || 'zzpPQseXi3m0oSbaey53JyM6UifXoHw63YJTV85U8hM='}`,
        'User-Agent': 'Vercel-API/1.0.0',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(railwayPayload),
      timeout: 30000 // 30 second timeout for initial response
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      console.error(`[${requestId}] Railway error:`, errorData);
      
      return res.status(response.status).json({
        error: 'Processing service error',
        message: errorData.error || 'Unknown error from processing service',
        requestId,
        details: errorData
      });
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;
    
    // Log successful proxy
    console.log(`[${requestId}] Successfully proxied to Railway in ${processingTime}ms`);
    
    // Return success response with additional metadata
    res.status(200).json({
      ...data,
      requestId,
      apiVersion: '1.0.0',
      processingStarted: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 60000).toISOString() // 1 minute estimate
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] Proxy error after ${processingTime}ms:`, error.message);
    
    // Handle different types of errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Processing service did not respond in time',
        requestId,
        retryAfter: 30
      });
    }
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Processing service is temporarily unavailable',
        requestId,
        retryAfter: 60
      });
    }
    
    // Generic error
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request',
      requestId
    });
  }
}