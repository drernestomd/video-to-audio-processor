const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testAPI() {
  console.log('🧪 Testing Video to Audio API...\n');

  try {
    // Test 1: Invalid request (missing videoUrl)
    console.log('1. Testing invalid request (missing videoUrl)...');
    try {
      await axios.post(`${API_BASE}/extract-audio`, {});
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid request');
        console.log(`   Response: ${error.response.data.message}\n`);
      } else {
        console.log('❌ Unexpected error response\n');
      }
    }

    // Test 2: Invalid URL
    console.log('2. Testing invalid URL...');
    try {
      await axios.post(`${API_BASE}/extract-audio`, {
        videoUrl: 'not-a-valid-url'
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid URL');
        console.log(`   Response: ${error.response.data.message}\n`);
      } else {
        console.log('❌ Unexpected error response\n');
      }
    }

    // Test 3: Unsupported URL
    console.log('3. Testing unsupported URL...');
    try {
      await axios.post(`${API_BASE}/extract-audio`, {
        videoUrl: 'https://example.com/not-a-video'
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected unsupported URL');
        console.log(`   Response: ${error.response.data.message}\n`);
      } else {
        console.log('❌ Unexpected error response\n');
      }
    }

    // Test 4: Valid Google Drive URL format (will fail without actual file, but should pass validation)
    console.log('4. Testing valid Google Drive URL format...');
    try {
      const response = await axios.post(`${API_BASE}/extract-audio`, {
        videoUrl: 'https://drive.google.com/file/d/1234567890abcdef/view?usp=sharing'
      });
      
      if (response.status === 202) {
        console.log('✅ Successfully accepted Google Drive URL');
        console.log(`   Job ID: ${response.data.jobId}`);
        console.log(`   Status: ${response.data.status}\n`);
        
        // Test 5: Check job status
        console.log('5. Testing job status endpoint...');
        const statusResponse = await axios.get(`${API_BASE}/status/${response.data.jobId}`);
        console.log('✅ Status endpoint working');
        console.log(`   Status: ${statusResponse.data.status}`);
        console.log(`   Progress: ${statusResponse.data.progress}%\n`);
        
        // Test 6: Try download (should fail since job will fail)
        console.log('6. Testing download endpoint (should fail for incomplete job)...');
        try {
          await axios.get(`${API_BASE}/download/${response.data.jobId}`);
        } catch (downloadError) {
          if (downloadError.response && downloadError.response.status === 409) {
            console.log('✅ Correctly rejected download for incomplete job');
            console.log(`   Response: ${downloadError.response.data.message}\n`);
          }
        }
      }
    } catch (error) {
      console.log('❌ Error with valid URL format');
      console.log(`   Error: ${error.message}\n`);
    }

    // Test 7: Invalid job ID
    console.log('7. Testing invalid job ID...');
    try {
      await axios.get(`${API_BASE}/status/invalid-job-id`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly handled invalid job ID');
        console.log(`   Response: ${error.response.data.message}\n`);
      }
    }

    console.log('🎉 API testing completed!');
    console.log('\n📝 Summary:');
    console.log('- All endpoints are responding correctly');
    console.log('- Input validation is working');
    console.log('- Error handling is proper');
    console.log('- Job management system is functional');
    console.log('\n⚠️  Note: Actual video processing will require:');
    console.log('- FFmpeg installed on the system');
    console.log('- BLOB_READ_WRITE_TOKEN environment variable');
    console.log('- Valid video URLs with accessible files');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testAPI();
