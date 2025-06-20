// Test different network approaches to reach Railway from Vercel
import https from 'https';
import http from 'http';

async function testRailwayConnectivity() {
  const railwayUrl = 'https://video-to-audio-processor-production.up.railway.app';
  
  console.log('Testing Railway connectivity with different approaches...');
  
  // Test 1: Using Node.js https module
  console.log('\n1. Testing with Node.js https module...');
  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request(railwayUrl + '/health', {
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'Vercel-Function/1.0.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
    
    console.log('✅ Node.js https success:', response);
  } catch (error) {
    console.log('❌ Node.js https failed:', error.message);
  }
  
  // Test 2: Using fetch
  console.log('\n2. Testing with fetch...');
  try {
    const response = await fetch(railwayUrl + '/health', {
      method: 'GET',
      headers: {
        'User-Agent': 'Vercel-Function/1.0.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    const data = await response.text();
    console.log('✅ Fetch success:', { status: response.status, data });
  } catch (error) {
    console.log('❌ Fetch failed:', error.message);
  }
}

testRailwayConnectivity();
