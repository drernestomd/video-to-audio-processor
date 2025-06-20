const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.PROCESSING_SERVICE_TOKEN || 'default-token';
  
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'video-to-audio-processor',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ffmpeg: 'native',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  });
});

// Process video endpoint
app.post('/process', authenticateRequest, async (req, res) => {
  const { jobId, videoUrl, webhookUrl, callbackHeaders } = req.body;
  
  if (!jobId || !videoUrl || !webhookUrl) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['jobId', 'videoUrl', 'webhookUrl']
    });
  }

  const externalJobId = uuidv4();
  
  // Respond immediately
  res.json({
    success: true,
    externalJobId,
    jobId,
    message: 'Processing started',
    estimatedTime: '30-60 seconds'
  });

  // Process asynchronously
  processVideoAsync(jobId, externalJobId, videoUrl, webhookUrl, callbackHeaders);
});

async function processVideoAsync(jobId, externalJobId, videoUrl, webhookUrl, callbackHeaders = {}) {
  const startTime = Date.now();
  let downloadedFilePath = null;
  let audioFilePath = null;

  try {
    console.log(`Starting processing for job ${jobId} (external: ${externalJobId})`);
    
    // Notify processing started
    await sendWebhook(webhookUrl, {
      jobId,
      externalJobId,
      status: 'processing',
      progress: 10,
      serviceType: 'railway'
    }, callbackHeaders);

    // Step 1: Download video file
    console.log(`Downloading video for job ${jobId}`);
    downloadedFilePath = await downloadFile(videoUrl, externalJobId);
    
    await sendWebhook(webhookUrl, {
      jobId,
      externalJobId,
      status: 'processing',
      progress: 40,
      serviceType: 'railway'
    }, callbackHeaders);

    // Step 2: Extract audio using native FFmpeg
    console.log(`Extracting audio for job ${jobId}`);
    audioFilePath = await extractAudio(downloadedFilePath, externalJobId);
    
    await sendWebhook(webhookUrl, {
      jobId,
      externalJobId,
      status: 'processing',
      progress: 80,
      serviceType: 'railway'
    }, callbackHeaders);

    // Step 3: Upload to temporary storage (you could use your own storage here)
    console.log(`Uploading audio for job ${jobId}`);
    const audioUrl = await uploadAudio(audioFilePath, externalJobId);
    
    const processingTime = Date.now() - startTime;
    
    // Notify completion
    await sendWebhook(webhookUrl, {
      jobId,
      externalJobId,
      status: 'completed',
      progress: 100,
      audioUrl,
      processingTime,
      serviceType: 'railway',
      metadata: {
        processingTimeMs: processingTime,
        processingTimeSeconds: Math.round(processingTime / 1000),
        service: 'railway-native-ffmpeg'
      }
    }, callbackHeaders);

    console.log(`Job ${jobId} completed successfully in ${processingTime}ms`);

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    
    await sendWebhook(webhookUrl, {
      jobId,
      externalJobId,
      status: 'failed',
      error: error.message,
      serviceType: 'railway'
    }, callbackHeaders);
  } finally {
    // Cleanup
    if (downloadedFilePath) cleanupFile(downloadedFilePath);
    if (audioFilePath) cleanupFile(audioFilePath);
  }
}

async function downloadFile(url, jobId) {
  const tempDir = os.tmpdir();
  const fileName = `${jobId}_video${path.extname(url) || '.mp4'}`;
  const filePath = path.join(tempDir, fileName);

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 120000, // 2 minutes
    headers: {
      'User-Agent': 'Railway-Video-Processor/1.0.0'
    }
  });

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

async function extractAudio(inputPath, jobId) {
  const tempDir = os.tmpdir();
  const outputPath = path.join(tempDir, `${jobId}.mp3`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(44100)
      .format('mp3')
      .output(outputPath)
      .on('end', () => {
        console.log('Audio extraction completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .run();
  });
}

async function uploadAudio(audioFilePath, jobId) {
  // Read the audio file
  const audioBuffer = fs.readFileSync(audioFilePath);
  const fileName = `${jobId}.mp3`;
  
  // Upload to Vercel Blob Storage using the same token
  try {
    const response = await axios.put(
      `https://blob.vercel-storage.com/${fileName}`, 
      audioBuffer,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
          'Content-Type': 'audio/mpeg',
          'x-content-type': 'audio/mpeg'
        },
        timeout: 60000
      }
    );
    
    return response.data.url;
  } catch (error) {
    console.error('Upload failed:', error);
    // Fallback: return a temporary URL (you could implement a simple file server)
    throw new Error('Failed to upload audio file');
  }
}

async function sendWebhook(webhookUrl, payload, headers = {}) {
  try {
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000
    });
  } catch (error) {
    console.error('Webhook failed:', error.message);
  }
}

function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup ${filePath}:`, error);
  }
}

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Video-to-Audio Processor running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Process endpoint: http://localhost:${PORT}/process`);
});
