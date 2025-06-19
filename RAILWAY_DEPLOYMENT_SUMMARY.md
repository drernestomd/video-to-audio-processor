# Railway Deployment Summary

## Files to Upload to GitHub

Upload these 3 files to your GitHub repository `video-to-audio-processor`:

### 1. package.json
```json
{
  "name": "video-to-audio-processor",
  "version": "1.0.0",
  "description": "Fast video-to-audio processing service with native FFmpeg",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": ["video", "audio", "ffmpeg", "processing"],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "fluent-ffmpeg": "^2.1.3",
    "axios": "^1.6.2",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 2. server.js
(Copy the complete server.js file from railway-processor/server.js)

### 3. README.md
(Copy the README.md file from railway-processor/README.md)

## Railway Environment Variables (Already Set ✅)

- `PROCESSING_SERVICE_TOKEN=railway_secure_token_2024_vta_api`
- `PORT=3001`
- `NODE_ENV=production`

## Railway Project Details

- **Project URL**: https://railway.com/project/b3c36b01-6b81-452a-a7c4-f4ed488645a1
- **Service Name**: video-to-audio-api

## Next Steps After Railway Deployment

1. Get Railway service URL (e.g., `https://your-app.railway.app`)
2. Add to Vercel environment variables:
   - `RAILWAY_PROCESSING_URL=https://your-app.railway.app`
   - `PROCESSING_SERVICE_TOKEN=railway_secure_token_2024_vta_api`
   - `WEBHOOK_SECRET=webhook_secret_2024_vta_secure_key`
3. Redeploy Vercel with `vercel --prod`
4. Test the hybrid system

## Testing Commands

```bash
# Test Railway service directly
curl https://your-railway-app.railway.app/health

# Test Vercel with Railway integration
curl https://video-to-audio-j4tdcc5bg-ernestos-projects-e9a7d5c3.vercel.app/api/health

# Test fast processing
curl -X POST https://video-to-audio-j4tdcc5bg-ernestos-projects-e9a7d5c3.vercel.app/api/extract-audio \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "YOUR_VIDEO_URL", "processingService": "railway"}'
