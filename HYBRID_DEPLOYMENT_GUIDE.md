# Hybrid Video-to-Audio API Deployment Guide

This guide covers deploying the hybrid video-to-audio conversion system with both fast external processing and fallback WebAssembly processing.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel API    │    │  Railway/Render  │    │  Vercel Blob    │
│  (Job Manager)  │◄──►│   (Fast FFmpeg)  │◄──►│   (Storage)     │
│                 │    │                  │    │                 │
│ • Job Creation  │    │ • Native FFmpeg  │    │ • MP3 Storage   │
│ • Status Track  │    │ • Fast Process   │    │ • Public URLs   │
│ • WebAssembly   │    │ • Webhooks       │    │ • Auto Cleanup  │
│   Fallback      │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Deployment Steps

### Step 1: Deploy Main API (Vercel)

Your main API is already deployed at:
`https://video-to-audio-d7rr8b8tq-ernestos-projects-e9a7d5c3.vercel.app`

### Step 2: Deploy Fast Processing Service (Railway)

1. **Create Railway Account**: [railway.app](https://railway.app)

2. **Deploy Processing Service**:
```bash
cd video-to-audio-api/railway-processor
git init
git add .
git commit -m "Initial Railway processor"

# Connect to Railway
railway login
railway init
railway up
```

3. **Set Environment Variables in Railway**:
```bash
railway variables set PROCESSING_SERVICE_TOKEN=your-secure-token-here
railway variables set PORT=3001
```

4. **Get Railway URL**:
```bash
railway domain
# Example: https://your-app.railway.app
```

### Step 3: Configure Vercel with Railway URL

Add environment variables to your Vercel project:

```bash
cd video-to-audio-api
vercel env add RAILWAY_PROCESSING_URL
# Enter: https://your-app.railway.app

vercel env add PROCESSING_SERVICE_TOKEN
# Enter: your-secure-token-here

vercel env add WEBHOOK_SECRET
# Enter: your-webhook-secret-here

# Redeploy
vercel --prod
```

### Step 4: Test Hybrid System

```bash
# Test health endpoint (should show external processing available)
curl https://video-to-audio-d7rr8b8tq-ernestos-projects-e9a7d5c3.vercel.app/api/health

# Test with Railway processing (fast)
curl -X POST https://video-to-audio-d7rr8b8tq-ernestos-projects-e9a7d5c3.vercel.app/api/extract-audio \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "YOUR_VIDEO_URL", "processingService": "railway"}'

# Test with Vercel fallback (slow but reliable)
curl -X POST https://video-to-audio-d7rr8b8tq-ernestos-projects-e9a7d5c3.vercel.app/api/extract-audio \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "YOUR_VIDEO_URL", "processingService": "vercel"}'
```

## 🔧 Configuration Options

### Environment Variables

#### Vercel (Main API)
```env
# Required
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx

# Optional - External Processing
RAILWAY_PROCESSING_URL=https://your-app.railway.app
RENDER_PROCESSING_URL=https://your-app.onrender.com
PROCESSING_SERVICE_TOKEN=your-secure-token
WEBHOOK_SECRET=your-webhook-secret
```

#### Railway/Render (Processing Service)
```env
# Required
PROCESSING_SERVICE_TOKEN=your-secure-token
PORT=3001

# Optional
NODE_ENV=production
```

### Processing Service Selection

The API automatically chooses the best available service:

1. **Railway** (if configured) - Fastest
2. **Render** (if configured) - Fast alternative
3. **Vercel WebAssembly** - Reliable fallback

You can also specify the service in your request:

```json
{
  "videoUrl": "https://example.com/video.mp4",
  "processingService": "railway"  // or "render" or "vercel"
}
```

## 📊 Performance Comparison

| Service | Speed | Reliability | Cost | Setup |
|---------|-------|-------------|------|-------|
| Railway | ⚡⚡⚡ | ⭐⭐⭐ | 💰💰 | Easy |
| Render | ⚡⚡ | ⭐⭐⭐ | 💰 | Easy |
| Vercel | ⚡ | ⭐⭐⭐⭐ | 💰 | None |

## 🔄 API Usage Examples

### Basic Usage (Auto-Select Best Service)
```javascript
const response = await fetch('/api/extract-audio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID/view'
  })
});

const { jobId, processingService, serviceName } = await response.json();
console.log(`Using ${serviceName} for processing`);
```

### Force Specific Service
```javascript
const response = await fetch('/api/extract-audio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID/view',
    processingService: 'railway'  // Force Railway processing
  })
});
```

### Check Available Services
```javascript
const health = await fetch('/api/health').then(r => r.json());
console.log('Available services:', health.processingServices.available);
console.log('Default service:', health.processingServices.default);
```

## 🛠️ Advanced Configuration

### Custom Storage for Railway Service

Update `railway-processor/server.js` to use your preferred storage:

```javascript
async function uploadAudio(audioFilePath, jobId) {
  // Example: AWS S3
  const s3 = new AWS.S3();
  const fileContent = fs.readFileSync(audioFilePath);
  
  const params = {
    Bucket: 'your-bucket',
    Key: `audio/${jobId}.mp3`,
    Body: fileContent,
    ContentType: 'audio/mpeg'
  };
  
  const result = await s3.upload(params).promise();
  return result.Location;
}
```

### Webhook Security

The system uses HMAC signatures for webhook security:

```javascript
// Webhook validation in processing service
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

headers['X-Signature'] = `sha256=${signature}`;
```

### Load Balancing Multiple Services

You can deploy multiple Railway instances and load balance:

```env
RAILWAY_PROCESSING_URL=https://processor-1.railway.app,https://processor-2.railway.app
```

## 🚨 Troubleshooting

### Common Issues

1. **External Service Not Available**
   - Check Railway/Render deployment status
   - Verify environment variables
   - Test service health endpoint

2. **Webhook Failures**
   - Check webhook URL accessibility
   - Verify webhook secret configuration
   - Monitor webhook logs

3. **Processing Timeouts**
   - Railway: Check service logs
   - Vercel: Increase timeout (max 60s)
   - Consider file size limits

### Debug Commands

```bash
# Check service health
curl https://your-processor.railway.app/health

# Test webhook endpoint
curl https://video-to-audio-d7rr8b8tq-ernestos-projects-e9a7d5c3.vercel.app/api/webhook/processing-complete

# Check Vercel logs
vercel logs

# Check Railway logs
railway logs
```

## 📈 Monitoring & Scaling

### Metrics to Monitor

- **Processing Time**: Railway vs Vercel comparison
- **Success Rate**: Per service success/failure rates
- **Queue Length**: Number of pending jobs
- **Error Rates**: Failed processing attempts

### Scaling Strategies

1. **Horizontal Scaling**: Deploy multiple Railway instances
2. **Auto-scaling**: Use Railway's auto-scaling features
3. **Load Balancing**: Distribute jobs across services
4. **Caching**: Cache frequently converted files

## 🔐 Security Best Practices

1. **API Authentication**: Add API keys for public access
2. **Webhook Security**: Use HMAC signatures
3. **Rate Limiting**: Implement request rate limits
4. **Input Validation**: Validate all video URLs
5. **File Cleanup**: Ensure temporary files are cleaned

## 💰 Cost Optimization

### Railway Pricing
- **Hobby Plan**: $5/month (512MB RAM, 1GB storage)
- **Pro Plan**: $20/month (8GB RAM, 100GB storage)

### Vercel Pricing
- **Hobby**: Free (100GB bandwidth, 60s timeout)
- **Pro**: $20/month (1TB bandwidth, custom domains)

### Recommendations
- Use Railway for fast processing
- Keep Vercel as reliable fallback
- Monitor usage and scale accordingly

---

## 🎉 Your Hybrid System is Ready!

You now have a production-ready video-to-audio conversion API with:

✅ **Fast Processing**: Railway with native FFmpeg  
✅ **Reliable Fallback**: Vercel WebAssembly  
✅ **Automatic Selection**: Best service auto-chosen  
✅ **Webhook Integration**: Real-time status updates  
✅ **Comprehensive Monitoring**: Health checks and metrics  

**Next Steps:**
1. Deploy Railway processing service
2. Configure environment variables
3. Test with real video files
4. Monitor performance and scale as needed
