const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

class FileDownloader {
  static convertGoogleDriveUrl(url) {
    // Handle different Google Drive URL formats
    const patterns = [
      // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      // https://drive.google.com/open?id=FILE_ID
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
      // https://docs.google.com/file/d/FILE_ID/edit
      /docs\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    // If it's already a direct download URL or not a Google Drive URL, return as is
    return url;
  }

  static async downloadFile(url, jobId, onProgress = null) {
    try {
      // Convert Google Drive URLs to direct download URLs
      const downloadUrl = this.convertGoogleDriveUrl(url);
      
      // Create temporary file path
      const tempDir = os.tmpdir();
      const fileName = `${jobId}_video${path.extname(url) || '.mp4'}`;
      const filePath = path.join(tempDir, fileName);

      console.log(`Downloading file from: ${downloadUrl}`);
      console.log(`Saving to: ${filePath}`);

      // Configure axios for file download
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 300000, // 5 minutes timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 5
      });

      // Handle Google Drive virus scan warning
      if (response.headers['content-type']?.includes('text/html')) {
        // This might be a Google Drive warning page, try to extract the real download URL
        const htmlContent = await this.streamToString(response.data);
        const confirmMatch = htmlContent.match(/confirm=([^&"]+)/);
        if (confirmMatch) {
          const confirmCode = confirmMatch[1];
          const newUrl = `${downloadUrl}&confirm=${confirmCode}`;
          return this.downloadFile(newUrl, jobId, onProgress);
        }
      }

      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;

      // Create write stream
      const writer = fs.createWriteStream(filePath);

      // Track download progress
      response.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize > 0) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          onProgress(progress);
        }
      });

      // Pipe the response to file
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Download completed: ${filePath}`);
          resolve(filePath);
        });

        writer.on('error', (error) => {
          console.error('Download error:', error);
          this.cleanupFile(filePath);
          reject(error);
        });

        response.data.on('error', (error) => {
          console.error('Stream error:', error);
          this.cleanupFile(filePath);
          reject(error);
        });
      });

    } catch (error) {
      console.error('Download failed:', error);
      
      if (error.response) {
        throw new Error(`Download failed: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Download failed: No response received from server');
      } else {
        throw new Error(`Download failed: ${error.message}`);
      }
    }
  }

  static async streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  static isSupportedVideoUrl(url) {
    const supportedDomains = [
      'drive.google.com',
      'docs.google.com',
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'dropbox.com',
      'onedrive.live.com'
    ];

    const supportedExtensions = [
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'
    ];

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // Check if it's from a supported domain
      const isSupportedDomain = supportedDomains.some(supportedDomain => 
        domain.includes(supportedDomain)
      );

      // Check if it has a supported extension
      const hasSupportedExtension = supportedExtensions.some(ext => 
        pathname.endsWith(ext)
      );

      return isSupportedDomain || hasSupportedExtension;
    } catch (error) {
      return false;
    }
  }

  static cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup file ${filePath}:`, error);
    }
  }

  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = FileDownloader;
