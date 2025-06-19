const axios = require('axios');

const API_BASE = 'https://video-to-audio-d7rr8b8tq-ernestos-projects-e9a7d5c3.vercel.app/api';

async function testProductionAPI() {
  console.log('🧪 Testing Production Video-to-Audio API...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/health`, { timeout: 10000 });
    console.log('✅ Health check passed');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Environment: ${healthResponse.data.environment}`);
    console.log(`   FFmpeg: ${healthResponse.data.checks.ffmpeg}`);
    console.log(`   Storage: ${healthResponse.data.checks.storage}\n`);

    // Test 2: Invalid request (should respond quickly)
    console.log('2. Testing invalid request (missing videoUrl)...');
    try {
      await axios.post(`${API_BASE}/extract-audio`, {}, { timeout: 10000 });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid request');
        console.log(`   Response: ${error.response.data.message}\n`);
      } else {
        console.log('❌ Unexpected error response');
        console.log(`   Error: ${error.message}\n`);
      }
    }

    // Test 3: Invalid URL (should respond quickly)
    console.log('3. Testing invalid URL...');
    try {
      await axios.post(`${API_BASE}/extract-audio`, {
        videoUrl: 'not-a-valid-url'
      }, { timeout: 10000 });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid URL');
        console.log(`   Response: ${error.response.data.message}\n`);
      } else {
        console.log('❌ Unexpected error response');
        console.log(`   Error: ${error.message}\n`);
      }
    }

    // Test 4: Valid request with timeout handling
    console.log('4. Testing valid video URL (with extended timeout)...');
    try {
      const response = await axios.post(`${API_BASE}/extract-audio`, {
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
      }, { 
        timeout: 65000 // 65 seconds to account for Vercel's 60s limit
      });
      
      if (response.status === 202) {
        console.log('✅ Successfully accepted video URL');
        console.log(`   Job ID: ${response.data.jobId}`);
        console.log(`   Status: ${response.data.status}\n`);
        
        // Test 5: Check job status
        console.log('5. Testing job status endpoint...');
        const statusResponse = await axios.get(`${API_BASE}/status/${response.data.jobId}`, { timeout: 10000 });
        console.log('✅ Status endpoint working');
        console.log(`   Status: ${statusResponse.data.status}`);
        console.log(`   Progress: ${statusResponse.data.progress}%\n`);
        
        // Wait a bit and check status again
        console.log('6. Waiting 10 seconds and checking status again...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const statusResponse2 = await axios.get(`${API_BASE}/status/${response.data.jobId}`, { timeout: 10000 });
        console.log(`   Status: ${statusResponse2.data.status}`);
        console.log(`   Progress: ${statusResponse2.data.progress}%`);
        
        if (statusResponse2.data.status === 'failed') {
          console.log(`   Error: ${statusResponse2.data.error}\n`);
        }
        
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log('⚠️  Request timed out (this might be expected for video processing)');
        console.log('   This could indicate the function is taking longer than 60 seconds\n');
      } else {
        console.log('❌ Error with valid URL');
        console.log(`   Error: ${error.message}`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}\n`);
        }
      }
    }

    console.log('🎉 Production API testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testProductionAPI();
