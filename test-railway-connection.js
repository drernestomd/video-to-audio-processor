import https from 'https';

// Test Railway service directly
async function testRailwayService() {
    console.log('🧪 Testing Railway Service Connection...\n');
    
    // First, let's get the Railway URL from our Vercel health endpoint
    console.log('1. Getting Railway URL from Vercel health endpoint...');
    
    try {
        const healthResponse = await makeRequest('video-to-audio-puwveu8zj-ernestos-projects-e9a7d5c3.vercel.app', '/api/health', 'GET');
        console.log('✅ Health endpoint accessible');
        
        // Extract Railway URL from environment (we need to check the actual URL)
        // For now, let's try the common Railway URL pattern
        const possibleRailwayUrls = [
            'video-to-audio-api-production.up.railway.app',
            'video-to-audio-processor-production.up.railway.app',
            'video-to-audio-api.railway.app'
        ];
        
        console.log('\n2. Testing possible Railway URLs...');
        
        for (const railwayUrl of possibleRailwayUrls) {
            console.log(`\n🔍 Testing: https://${railwayUrl}`);
            
            try {
                // Test health endpoint
                const healthResult = await makeRequest(railwayUrl, '/health', 'GET');
                console.log(`✅ Railway health check successful on ${railwayUrl}`);
                console.log('Response:', JSON.stringify(healthResult.data, null, 2));
                
                // Test process endpoint with a sample request
                console.log(`\n🧪 Testing process endpoint on ${railwayUrl}...`);
                const processResult = await makeRequest(railwayUrl, '/process', 'POST', {
                    jobId: 'test-job-123',
                    videoUrl: 'https://www.dropbox.com/s/example/test.mp4?dl=1',
                    webhookUrl: 'https://video-to-audio-puwveu8zj-ernestos-projects-e9a7d5c3.vercel.app/api/webhook/processing-complete',
                    callbackHeaders: {
                        'Authorization': 'Bearer webhook_secret_2024_vta_secure_key'
                    }
                }, {
                    'Authorization': 'Bearer railway_secure_token_2024_vta_api'
                });
                
                console.log(`✅ Railway process endpoint test successful`);
                console.log('Response:', JSON.stringify(processResult.data, null, 2));
                
                return railwayUrl; // Found working URL
                
            } catch (error) {
                console.log(`❌ Failed to connect to ${railwayUrl}: ${error.message}`);
            }
        }
        
        console.log('\n❌ No working Railway URLs found');
        
    } catch (error) {
        console.error('❌ Failed to get health info:', error.message);
    }
}

function makeRequest(hostname, path, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Railway-Test-Script',
                ...headers
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            const postData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsedData,
                        headers: res.headers
                    });
                } catch (parseError) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData,
                        headers: res.headers
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (data && (method === 'POST' || method === 'PUT')) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

testRailwayService().catch(console.error);
