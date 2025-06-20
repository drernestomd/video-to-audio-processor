// Proxy endpoint to reach Railway from Vercel
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const railwayUrl = process.env.RAILWAY_PROCESSING_URL || 'https://video-processor-final-production.up.railway.app';
  const maxRetries = 2;
  let lastError = null;

  console.log(`Proxying request to Railway: ${railwayUrl}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} - Contacting Railway...`);
      
      // Use fetch with extended timeout for Railway processing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
      
      const response = await fetch(`${railwayUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PROCESSING_SERVICE_TOKEN || 'zzpPQseXi3m0oSbaey53JyM6UifXoHw63YJTV85U8hM='}`,
          'User-Agent': 'Vercel-Proxy/1.0.0',
          'X-Forwarded-For': req.headers['x-forwarded-for'] || 'vercel',
          'X-Request-ID': req.headers['x-request-id'] || `proxy-${Date.now()}`
        },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(`Railway HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Railway proxy successful:', data);
      
      return res.status(response.status).json(data);

    } catch (error) {
      lastError = error;
      console.error(`Railway proxy attempt ${attempt} failed:`, error.message);
      
      // If it's the last attempt or a non-retryable error, don't retry
      if (attempt === maxRetries || error.name === 'AbortError' || error.message.includes('401') || error.message.includes('403')) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All attempts failed
  console.error('All Railway proxy attempts failed:', lastError?.message);
  
  // Determine appropriate error response based on the last error
  if (lastError?.name === 'AbortError') {
    return res.status(504).json({
      error: 'Gateway timeout',
      message: 'Railway service did not respond within the timeout period',
      details: 'The Railway processing service is taking too long to respond',
      retryAfter: 60
    });
  }
  
  if (lastError?.message?.includes('401') || lastError?.message?.includes('403')) {
    return res.status(502).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate with Railway service',
      details: 'Check PROCESSING_SERVICE_TOKEN configuration'
    });
  }
  
  return res.status(503).json({
    error: 'Railway proxy failed',
    message: lastError?.message || 'Unknown error',
    details: 'Unable to reach Railway through proxy after multiple attempts',
    attempts: maxRetries,
    retryAfter: 300 // 5 minutes
  });
}
