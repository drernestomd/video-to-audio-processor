const axios = require('axios');

class ProcessingService {
  constructor() {
    // Configuration for different processing services
    this.services = {
      railway: {
        url: process.env.RAILWAY_PROCESSING_URL,
        enabled: !!process.env.RAILWAY_PROCESSING_URL,
        name: 'Railway (Fast)',
        timeout: 300000 // 5 minutes
      },
      render: {
        url: process.env.RENDER_PROCESSING_URL,
        enabled: !!process.env.RENDER_PROCESSING_URL,
        name: 'Render (Fast)',
        timeout: 300000 // 5 minutes
      },
      vercel: {
        url: null, // Local processing
        enabled: true,
        name: 'Vercel WebAssembly (Slow)',
        timeout: 55000 // 55 seconds to stay under Vercel limit
      }
    };

    // Webhook URL for status updates
    this.webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/webhook/processing-complete`
      : process.env.WEBHOOK_URL;
  }

  /**
   * Get the best available processing service
   */
  getBestService() {
    // Priority order: Railway > Render > Vercel WebAssembly
    if (this.services.railway.enabled) {
      return { type: 'railway', config: this.services.railway };
    }
    if (this.services.render.enabled) {
      return { type: 'render', config: this.services.render };
    }
    return { type: 'vercel', config: this.services.vercel };
  }

  /**
   * Get all available services for user selection
   */
  getAvailableServices() {
    return Object.entries(this.services)
      .filter(([_, config]) => config.enabled)
      .map(([type, config]) => ({
        type,
        name: config.name,
        speed: type === 'vercel' ? 'slow' : 'fast',
        timeout: config.timeout
      }));
  }

  /**
   * Submit job to external processing service
   */
  async submitToExternalService(serviceType, jobId, videoUrl) {
    const service = this.services[serviceType];
    
    if (!service || !service.enabled || !service.url) {
      throw new Error(`Service ${serviceType} is not available`);
    }

    try {
      console.log(`Submitting job ${jobId} to ${service.name}`);
      
      const response = await axios.post(`${service.url}/process`, {
        jobId,
        videoUrl,
        webhookUrl: this.webhookUrl,
        callbackHeaders: {
          'Authorization': `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`
        }
      }, {
        timeout: 30000, // 30 seconds for submission
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PROCESSING_SERVICE_TOKEN || 'default-token'}`
        }
      });

      return {
        success: true,
        serviceType,
        serviceName: service.name,
        submittedAt: new Date().toISOString(),
        externalJobId: response.data.externalJobId || jobId
      };

    } catch (error) {
      console.error(`Failed to submit to ${service.name}:`, error.message);
      throw new Error(`Failed to submit job to ${service.name}: ${error.message}`);
    }
  }

  /**
   * Process job using the best available service
   */
  async processJob(jobId, videoUrl, preferredService = null) {
    const service = preferredService 
      ? { type: preferredService, config: this.services[preferredService] }
      : this.getBestService();

    if (!service.config.enabled) {
      throw new Error(`Requested service ${service.type} is not available`);
    }

    // If it's an external service, submit the job
    if (service.type !== 'vercel') {
      return await this.submitToExternalService(service.type, jobId, videoUrl);
    }

    // For Vercel, return indication to use local processing
    return {
      success: true,
      serviceType: 'vercel',
      serviceName: service.config.name,
      useLocalProcessing: true
    };
  }

  /**
   * Check if external processing is available
   */
  hasExternalProcessing() {
    return this.services.railway.enabled || this.services.render.enabled;
  }

  /**
   * Get service status and capabilities
   */
  async getServiceStatus() {
    const status = {};

    for (const [type, config] of Object.entries(this.services)) {
      if (type === 'vercel') {
        status[type] = {
          enabled: true,
          name: config.name,
          status: 'available',
          speed: 'slow',
          local: true
        };
        continue;
      }

      if (!config.enabled) {
        status[type] = {
          enabled: false,
          name: config.name,
          status: 'disabled'
        };
        continue;
      }

      try {
        // Check service health
        const response = await axios.get(`${config.url}/health`, {
          timeout: 5000,
          headers: {
            'Authorization': `Bearer ${process.env.PROCESSING_SERVICE_TOKEN || 'default-token'}`
          }
        });

        status[type] = {
          enabled: true,
          name: config.name,
          status: 'available',
          speed: 'fast',
          health: response.data,
          local: false
        };
      } catch (error) {
        status[type] = {
          enabled: true,
          name: config.name,
          status: 'unavailable',
          error: error.message,
          local: false
        };
      }
    }

    return status;
  }

  /**
   * Validate webhook signature (for security)
   */
  validateWebhook(signature, payload) {
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  }
}

module.exports = ProcessingService;
