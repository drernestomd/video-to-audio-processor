const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

class FFmpegProcessor {
  static async extractAudio(inputPath, outputPath, onProgress = null) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .audioChannels(2)
        .audioFrequency(44100)
        .format('mp3')
        .output(outputPath);

      // Set up progress tracking if callback provided
      if (onProgress) {
        command.on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          onProgress(percent);
        });
      }

      command
        .on('end', () => {
          console.log('Audio extraction completed successfully');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  }

  static async processVideoToAudio(inputPath, jobId, onProgress = null) {
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

  static getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        if (!audioStream) {
          reject(new Error('No audio stream found in the file'));
          return;
        }

        resolve({
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          codec: audioStream.codec_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels
        });
      });
    });
  }

  static async validateVideoFile(filePath) {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            reject(new Error(`Invalid video file: ${err.message}`));
            return;
          }

          const hasVideo = metadata.streams.some(stream => stream.codec_type === 'video');
          const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');

          if (!hasVideo && !hasAudio) {
            reject(new Error('File contains no video or audio streams'));
            return;
          }

          if (!hasAudio) {
            reject(new Error('Video file contains no audio stream'));
            return;
          }

          resolve({
            valid: true,
            duration: metadata.format.duration,
            hasVideo,
            hasAudio,
            format: metadata.format.format_name
          });
        });
      });
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
}

module.exports = FFmpegProcessor;
