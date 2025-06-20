const fs = require('fs');
const path = require('path');
const os = require('os');

class FFmpegWasmProcessor {
  constructor() {
    this.ffmpeg = null;
    this.isLoaded = false;
  }

  async initialize() {
    if (this.isLoaded) return;

    try {
      // Dynamic import for ESM packages
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      
      this.ffmpeg = new FFmpeg();
      
      // Load FFmpeg WebAssembly
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('FFmpeg WebAssembly loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg WebAssembly:', error);
      throw new Error('FFmpeg initialization failed');
    }
  }

  async extractAudio(inputPath, outputPath, onProgress = null) {
    try {
      await this.initialize();

      // Dynamic import for fetchFile
      const { fetchFile } = await import('@ffmpeg/util');
      
      // Read input file
      const inputData = await fetchFile(inputPath);
      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp3';

      // Write input file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, inputData);

      // Set up progress tracking
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          const percent = Math.round(progress * 100);
          onProgress(percent);
        });
      }

      // Convert video to audio
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-vn', // No video
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '44100',
        '-ac', '2',
        outputFileName
      ]);

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputFileName);

      // Write to output path
      fs.writeFileSync(outputPath, outputData);

      // Cleanup FFmpeg filesystem
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);

      console.log('Audio extraction completed successfully');
      return outputPath;

    } catch (error) {
      console.error('FFmpeg WebAssembly error:', error);
      throw error;
    }
  }

  async processVideoToAudio(inputPath, jobId, onProgress = null) {
    try {
      // Create temporary output path
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `${jobId}.mp3`);

      // Extract audio
      await this.extractAudio(inputPath, outputPath, onProgress);

      // Verify output file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('Audio extraction failed - output file not created');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Audio extraction failed - output file is empty');
      }

      return outputPath;
    } catch (error) {
      console.error('Error processing video to audio:', error);
      throw error;
    }
  }

  async validateVideoFile(filePath) {
    try {
      await this.initialize();

      // Dynamic import for fetchFile
      const { fetchFile } = await import('@ffmpeg/util');
      
      // Read file
      const inputData = await fetchFile(filePath);
      const inputFileName = 'validate.mp4';

      // Write to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, inputData);

      // Get file info using ffprobe-like functionality
      // Note: WebAssembly FFmpeg has limited probe capabilities
      // We'll do basic validation by trying to read the file
      try {
        await this.ffmpeg.exec(['-i', inputFileName, '-t', '1', '-f', 'null', '-']);
        
        // If we get here, the file is readable
        await this.ffmpeg.deleteFile(inputFileName);
        
        return {
          valid: true,
          hasVideo: true, // Assume true for now
          hasAudio: true, // Assume true for now
          format: 'unknown'
        };
      } catch (probeError) {
        await this.ffmpeg.deleteFile(inputFileName);
        throw new Error('Invalid video file format');
      }

    } catch (error) {
      throw new Error(`Video validation failed: ${error.message}`);
    }
  }

  static cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  async terminate() {
    if (this.ffmpeg && this.isLoaded) {
      await this.ffmpeg.terminate();
      this.isLoaded = false;
      console.log('FFmpeg WebAssembly terminated');
    }
  }
}

// Export singleton instance
const ffmpegProcessor = new FFmpegWasmProcessor();

module.exports = ffmpegProcessor;
