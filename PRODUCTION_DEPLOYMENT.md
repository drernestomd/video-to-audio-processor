# Production Deployment Guide

This guide covers deploying the Video-to-Audio API to production with all necessary configurations.

## Pre-Deployment Checklist ✅

### 1. Environment Variables Setup
- [ ] **BLOB_READ_WRITE_TOKEN**: Get from Vercel Dashboard > Storage > Blob
- [ ] **NODE_ENV**: Set to `production`
- [ ] Optional: **API_TIMEOUT**, **MAX_FILE_SIZE**

### 2. Dependencies Verification
- [ ] All npm packages installed (`npm install`)
- [ ] WebAssembly FFmpeg packages added (`@ffmpeg/ffmpeg`, `@ffmpeg/util`)
- [ ] No security vulnerabilities (`npm audit`)

### 3. Code Quality
- [ ] All API endpoints tested
- [ ] Error handling implemented
- [ ] Input validation working
- [ ] File cleanup mechanisms in place

## Deployment Options

### Option A: Vercel (Recommended for MVP)

#### Advantages:
- ✅ Built-in Blob storage integration
- ✅ Automatic HTTPS and CDN
- ✅ Easy deployment from Git
- ✅ WebAssembly FFmpeg support

#### Limitations:
- ⚠️ 60-second timeout limit
- ⚠️ Memory constraints for large files
- ⚠️ Cold start delays

#### Deployment Steps:

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Deploy:**
```bash
cd video-to-audio-api
vercel
```

4. **Set Environment Variables:**
```bash
vercel env add BLOB_READ_WRITE_TOKEN
# Enter your token when prompted
```

5. **Redeploy with Environment Variables:**
```bash
vercel --prod
```

#### Vercel Dashboard Setup:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Navigate to Storage > Blob
3. Create a new Blob store (if not exists)
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add to Project Settings > Environment Variables

### Option B: Railway (Better for Production)

#### Advantages:
- ✅ Longer execution times
- ✅ More memory available
- ✅ Native FFmpeg support
- ✅ Persistent storage options

#### Deployment Steps:

1. **Create Railway Account:** [railway.app](https://railway.app)

2. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

3. **Login and Deploy:**
```bash
railway login
railway init
railway up
```

4. **Add Environment Variables:**
```bash
railway variables set BLOB_READ_WRITE_TOKEN=your_token_here
```

### Option C: Docker Deployment

#### Create Dockerfile:
```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Deploy to any cloud provider:
- **DigitalOcean App Platform**
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**

## Post-Deployment Configuration

### 1. Vercel Blob Storage Setup

1. **Create Blob Store:**
   - Go to Vercel Dashboard
   - Navigate to Storage > Blob
   - Click "Create Store"
   - Note the connection string

2. **Configure Environment Variable:**
   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxx
   ```

### 2. Domain Configuration (Optional)

1. **Custom Domain:**
   - Add domain in Vercel Dashboard
   - Update DNS records
   - SSL automatically configured

2. **API Subdomain:**
   - Consider `api.yourdomain.com`
   - Update CORS settings if needed

### 3. Monitoring Setup

#### Basic Monitoring:
- Vercel Analytics (built-in)
- Function logs in Vercel Dashboard
- Error tracking via console logs

#### Advanced Monitoring:
```bash
npm install @vercel/analytics
```

Add to your API routes:
```javascript
import { track } from '@vercel/analytics';

// Track API usage
track('video_conversion_started', { jobId });
```

## Performance Optimization

### 1. Memory Management
- Implement file size limits
- Add memory usage monitoring
- Optimize temporary file cleanup

### 2. Timeout Handling
```javascript
// Add to extract-audio.js
const PROCESSING_TIMEOUT = 50000; // 50 seconds

setTimeout(() => {
  JobManager.setJobFailed(jobId, 'Processing timeout');
}, PROCESSING_TIMEOUT);
```

### 3. Rate Limiting
```javascript
// Add rate limiting middleware
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 requests per windowMs
};
```

## Security Considerations

### 1. Input Validation
- ✅ URL validation implemented
- ✅ File type checking
- ✅ Size limits (recommended: 100MB max)

### 2. API Security
```javascript
// Add API key authentication (optional)
const API_KEY = process.env.API_KEY;
if (req.headers['x-api-key'] !== API_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### 3. CORS Configuration
```javascript
// Add CORS headers if needed
res.setHeader('Access-Control-Allow-Origin', 'https://yourdomain.com');
res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
```

## Testing in Production

### 1. Health Check Endpoint
Create `/api/health`:
```javascript
export default function handler(req, res) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
```

### 2. Test with Real Files
```bash
# Test with small video file
curl -X POST https://your-api.vercel.app/api/extract-audio \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"}'
```

## Troubleshooting

### Common Issues:

1. **FFmpeg Not Found:**
   - Ensure WebAssembly version is used on Vercel
   - Check environment detection logic

2. **Timeout Errors:**
   - Reduce video file size
   - Optimize processing pipeline
   - Consider chunked processing

3. **Memory Issues:**
   - Implement streaming where possible
   - Add file size validation
   - Monitor memory usage

4. **Blob Storage Errors:**
   - Verify BLOB_READ_WRITE_TOKEN
   - Check Vercel Blob quota
   - Ensure proper error handling

### Debug Mode:
```bash
# Enable debug logging
vercel env add DEBUG=true
```

## Scaling Considerations

### For High Volume:
1. **Queue System:** Implement Redis-based job queue
2. **Load Balancing:** Use multiple instances
3. **CDN:** Cache processed files
4. **Database:** Replace in-memory job storage

### Cost Optimization:
1. **File Cleanup:** Implement automatic cleanup
2. **Compression:** Optimize audio quality vs. size
3. **Caching:** Cache frequently requested conversions

## Support & Maintenance

### Regular Tasks:
- [ ] Monitor error rates
- [ ] Check storage usage
- [ ] Update dependencies
- [ ] Review performance metrics
- [ ] Clean up old files

### Emergency Contacts:
- Vercel Support: [vercel.com/support](https://vercel.com/support)
- FFmpeg Issues: Check WebAssembly compatibility
- Blob Storage: Monitor quota and usage

---

## Quick Start Commands

```bash
# Deploy to Vercel
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs

# Set environment variable
vercel env add BLOB_READ_WRITE_TOKEN

# Test health endpoint
curl https://your-api.vercel.app/api/health
```

Your API is now production-ready! 🚀
