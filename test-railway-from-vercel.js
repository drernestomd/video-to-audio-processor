// Test Railway connectivity from a simple Node.js script
import axios from 'axios';

async function testRailwayConnection() {
  console.log('Testing Railway connection...');
  
  try {
    // Test 1: Health check
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get('https://video-to-audio-processor-production.up.railway.app/health', {
      timeout: 10000
    });
    console.log('✅ Health check successful:', healthResponse.data);
    
    // Test 2: Process endpoint
    console.log('\n2. Testing process endpoint...');
    const processResponse = await axios.post('https://video-to-audio-processor-production.up.railway.app/process', {
      jobId: 'test-connection',
      videoUrl: 'https://www.dropbox.com/s/example/test.mp4?dl=1',
      webhookUrl: 'https://httpbin.org/post'
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer railway_secure_token_2024_vta_api'
      }
    });
    console.log('✅ Process endpoint successful:', processResponse.data);
    
  } catch (error) {
    console.error('❌ Railway connection failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Response status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    console.error('Config URL:', error.config?.url);
  }
}

testRailwayConnection();
