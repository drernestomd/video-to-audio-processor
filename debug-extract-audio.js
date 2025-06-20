// Debug script to isolate the 500 error in extract-audio
import { v4 as uuidv4 } from 'uuid';
import { JobManager, JOB_STATUS } from './lib/jobs.js';
import FileDownloader from './utils/download.js';
import ProcessingService from './lib/processing-service.js';

async function debugExtractAudio() {
    console.log('🔍 Debugging Extract Audio Logic...\n');
    
    const videoUrl = 'https://example.com/video.mp4';
    
    try {
        console.log('1. Testing URL validation...');
        
        // Test URL validation
        if (!FileDownloader.isValidUrl(videoUrl)) {
            console.log('❌ URL validation failed');
            return;
        }
        console.log('✅ URL is valid');
        
        if (!FileDownloader.isSupportedVideoUrl(videoUrl)) {
            console.log('❌ URL not supported');
            return;
        }
        console.log('✅ URL is supported');
        
        console.log('\n2. Testing ProcessingService initialization...');
        
        // Test ProcessingService initialization
        const processingServiceInstance = new ProcessingService();
        console.log('✅ ProcessingService created');
        
        console.log('\n3. Testing job creation...');
        
        // Test job creation
        const jobId = uuidv4();
        console.log(`Generated job ID: ${jobId}`);
        
        const job = JobManager.createJob(jobId, videoUrl);
        console.log('✅ Job created:', job);
        
        console.log('\n4. Testing processJob method...');
        
        // Test processJob method
        const processingResult = await processingServiceInstance.processJob(jobId, videoUrl);
        console.log('✅ ProcessJob result:', processingResult);
        
        console.log('\n🎉 All steps completed successfully!');
        
    } catch (error) {
        console.log(`\n❌ Error occurred: ${error.message}`);
        console.log(`Stack trace: ${error.stack}`);
    }
}

debugExtractAudio().catch(console.error);
