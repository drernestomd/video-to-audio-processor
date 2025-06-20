const axios = require('axios');

class ProcessingService {
  constructor() {
    // Configuration for different processing services
    this.services = {
      railway: {
        url: '/api/railway-proxy', // Use internal proxy instead of direct Railway URL
        enabled: !!process.env.RAILWAY_PROCESSING_URL,
        name: 'Railway Processing Service',
        timeout: 300000, // 5 minutes
        directUrl: process.env.RAILWAY_PROCESSING_URL || 'https://video-to-audio-processor-production.up.railway.app'
      }
    };

    // Webhook URL for status updates
    if (process.env.VERCEL_URL) {
      // Handle both cases: VERCEL_URL with or without https://
      const baseUrl = process.env.VERCEL_URL.startsWith('https://') 
        ? process.env.VERCEL_URL 
        : `https://${process.env.VERCEL_URL}`;
      this.webhookUrl = `${baseUrl}/api/webhook/processing-complete`;
    } else {
      this.webhookUrl = process.env.WEBHOOK_URL;
    }

    // Validate required environment variables
    this.validateEnvironment();
  }

  /**
   * Get Railway service configuration
   */
  getRailwayService() {
    return this.services.railway.enabled 
      ? { type: 'railway', config: this.services.railway }
      : null;
  }

  /**
   * Check if Railway service is available
   */
  isRailwayAvailable() {
    return this.services.railway.enabled;
  }

  /**
   * Submit job to processing service (internal proxy for Railway)
   */
  async submitToExternalService(serviceType, jobId, videoUrl) {
    const service = this.services[serviceType];
    
    if (!service || !service.enabled || !service.url) {
      throw new Error(`Service ${serviceType} is not available`);
    }

    try {
      console.log(`Submitting job ${jobId} to ${service.name} via internal proxy`);
      
      // For Railway, use internal proxy; for others, use direct URL
      const targetUrl = serviceType === 'railway' 
        ? service.url // This is '/api/railway-proxy'
        : `${service.url}/process`;
      
      const payload = {
        jobId,
        videoUrl,
        webhookUrl: this.webhookUrl,
        callbackHeaders: {
          'Authorization': `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`
        }
      };

      // Use fetch for internal proxy calls
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Video-Processor/1.0.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

      return {
        success: true,
        serviceType,
        serviceName: service.name,
        submittedAt: new Date().toISOString(),
        externalJobId: data.externalJobId || jobId
      };

    } catch (error) {
      console.error(`Failed to submit to ${service.name}:`, error.message);
      throw new Error(`Failed to submit job to ${service.name}: ${error.message}`);
    }
  }

  /**
   * Process job using RAILWAY ONLY - NO FALLBACKS - FAIL IF RAILWAY FAILS
   */
  async processJob(jobId, videoUrl, preferredService = null) {
    // Railway is REQUIRED - FAIL if not available
    if (!this.services.railway.enabled) {
      throw new Error('Railway processing service is REQUIRED. Set RAILWAY_PROCESSING_URL environment variable.');
    }

    console.log(`Submitting job ${jobId} to Railway processing service - NO FALLBACKS - WILL FAIL IF RAILWAY FAILS`);
    
    try {
      // FORCE Railway submission - let it fail if Railway is down
      const result = await this.submitToExternalService('railway', jobId, videoUrl);
      
      // Ensure it's marked as external processing
      result.externalProcessing = true;
      result.localProcessing = false;
      
      return result;
    } catch (error) {
      console.error(`Railway submission FAILED for job ${jobId}:`, error.message);
      throw new Error(`RAILWAY ONLY: ${error.message} - NO FALLBACK AVAILABLE`);
    }
  }

  /**
   * Check if Railway processing is available
   */
  hasExternalProcessing() {
    return this.services.railway.enabled;
  }

  /**
   * Get Railway service status
   */
  async getServiceStatus() {
    const config = this.services.railway;
    
    if (!config.enabled) {
      return {
        railway: {
          enabled: false,
          name: config.name,
          status: 'disabled',
          reason: 'RAILWAY_PROCESSING_URL not configured'
        }
      };
    }

    try {
      // Check Railway health via proxy
      const response = await axios.get('/api/railway-proxy/health', {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${process.env.PROCESSING_SERVICE_TOKEN || 'default-token'}`
        }
      });

      return {
        railway: {
          enabled: true,
          name: config.name,
          status: 'available',
          health: response.data,
          url: config.directUrl
        }
      };
    } catch (error) {
      return {
        railway: {
          enabled: true,
          name: config.name,
          status: 'unavailable',
          error: error.message,
          url: config.directUrl
        }
      };
    }
  }

  /**
   * Validate webhook signature (for security)
   */
  async validateWebhook(signature, payload) {
    const crypto = await import('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const warnings = [];
    
    if (!this.webhookUrl) {
      warnings.push('VERCEL_URL or WEBHOOK_URL not configured - webhooks may not work');
    }
    
    if (!process.env.RAILWAY_PROCESSING_URL) {
      warnings.push('RAILWAY_PROCESSING_URL not configured - Service will not work without Railway');
    }
    
    if (!process.env.PROCESSING_SERVICE_TOKEN) {
      warnings.push('PROCESSING_SERVICE_TOKEN not configured - Railway authentication may fail');
    }
    
    if (!process.env.WEBHOOK_SECRET) {
      warnings.push('WEBHOOK_SECRET not configured - using default (insecure)');
    }
    
    if (warnings.length > 0) {
      console.warn('ProcessingService configuration warnings:');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }
}

module.exports = ProcessingService;
