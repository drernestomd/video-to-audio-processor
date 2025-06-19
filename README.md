# Video to Audio API

A Next.js API service that converts video files to MP3 audio format. Supports Google Drive public share links and other video platforms.

## Features

- **Asynchronous Processing**: Jobs are processed in the background with status tracking
- **Google Drive Support**: Handles public Google Drive share links automatically
- **Progress Tracking**: Real-time progress updates during conversion
- **Temporary Storage**: Uses Vercel Blob for temporary MP3 storage
- **Error Handling**: Comprehensive error handling and validation
- **Automation Ready**: Perfect for use with n8n and other automation tools

## API Endpoints

### 1. Extract Audio
**POST** `/api/extract-audio`

Starts a new video-to-audio conversion job.

**Request Body:**
```json
{
  "videoUrl": "https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid-job-id",
  "status": "queued",
  "message": "Video processing started. Use the job ID to check status.",
  "statusUrl": "/api/status/uuid-job-id",
  "downloadUrl": "/api/download/uuid-job-id"
}
```

### 2. Check Status
**GET** `/api/status/[jobId]`

Check the status of a conversion job.

**Response (Processing):**
```json
{
  "jobId": "uuid-job-id",
  "status": "processing",
  "progress": 45,
  "currentStep": "Extracting audio",
  "progressMessage": "Converting video to audio... 45%",
  "createdAt": "2023-12-01T10:00:00.000Z",
  "updatedAt": "2023-12-01T10:02:30.000Z"
}
```

**Response (Completed):**
```json
{
  "jobId": "uuid-job-id",
  "status": "completed",
  "progress": 100,
  "message": "Job completed successfully",
  "audioUrl": "https://blob.vercel-storage.com/audio.mp3",
  "downloadUrl": "/api/download/uuid-job-id",
  "completedAt": "2023-12-01T10:03:00.000Z"
}
```

### 3. Download Audio
**GET** `/api/download/[jobId]`

Download the converted MP3 file.

**Response:** Binary MP3 file with appropriate headers.

## Job Status Values

- `queued`: Job is waiting to be processed
- `processing`: Job is currently being processed
- `completed`: Job finished successfully
- `failed`: Job failed with an error

## Supported Video Sources

- **Google Drive**: Public share links (automatically converted to direct download)
- **Direct URLs**: Direct links to video files
- **Other platforms**: YouTube, Vimeo, Dropbox, OneDrive (with public access)

## Supported Video Formats

- MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V

## Environment Variables

Create a `.env.local` file with the following variables:

```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## Installation & Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
Create `.env.local` with your Vercel Blob token.

3. **Install FFmpeg:**
Make sure FFmpeg is installed on your system:
- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/

4. **Run development server:**
```bash
npm run dev
```

5. **Build for production:**
```bash
npm run build
npm start
```

## Usage Examples

### Basic Usage with cURL

```bash
# Start conversion
curl -X POST http://localhost:3000/api/extract-audio \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://drive.google.com/file/d/YOUR_FILE_ID/view"}'

# Check status
curl http://localhost:3000/api/status/YOUR_JOB_ID

# Download audio
curl -O http://localhost:3000/api/download/YOUR_JOB_ID
```

### Usage with n8n

1. **HTTP Request Node** (POST to `/api/extract-audio`)
2. **Wait Node** (optional delay)
3. **HTTP Request Node** (GET status until completed)
4. **HTTP Request Node** (GET download when ready)

### Usage with JavaScript

```javascript
async function convertVideoToAudio(videoUrl) {
  // Start conversion
  const startResponse = await fetch('/api/extract-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoUrl })
  });
  
  const { jobId } = await startResponse.json();
  
  // Poll for completion
  let status = 'queued';
  while (status !== 'completed' && status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const statusResponse = await fetch(`/api/status/${jobId}`);
    const statusData = await statusResponse.json();
    status = statusData.status;
    
    console.log(`Progress: ${statusData.progress}%`);
  }
  
  if (status === 'completed') {
    // Download the audio file
    window.open(`/api/download/${jobId}`, '_blank');
  }
}
```

## Google Drive URL Formats

The API automatically handles these Google Drive URL formats:

- `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
- `https://drive.google.com/open?id=FILE_ID`
- `https://docs.google.com/file/d/FILE_ID/edit`

## Error Handling

The API provides detailed error messages for common issues:

- Invalid or missing video URL
- Unsupported video format
- Network/download errors
- FFmpeg processing errors
- Storage upload errors

## Deployment

### Vercel Deployment

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Deploy:**
```bash
vercel
```

3. **Set environment variables in Vercel dashboard:**
- `BLOB_READ_WRITE_TOKEN`

### Docker Deployment

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Limitations

- **File Size**: Limited by available memory and processing time
- **Processing Time**: 15-second timeout on Vercel (configurable)
- **Concurrent Jobs**: In-memory job storage (consider Redis for production)
- **Storage**: Temporary storage on Vercel Blob (files may be cleaned up)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the error messages in API responses
2. Verify FFmpeg installation
3. Ensure environment variables are set correctly
4. Check Vercel Blob storage configuration
