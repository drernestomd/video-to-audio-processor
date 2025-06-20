const https = require('https');

const DOMAIN = 'video-to-audio-fa616i824-ernestos-projects-e9a7d5c3.vercel.app';

async function testExtractAudio() {
    console.log('🧪 Testing Extract Audio API...\n');
    
    const testCases = [
        {
            name: 'Valid Google Drive URL',
            data: { videoUrl: 'https://drive.google.com/file/d/1234567890/view' }
        },
        {
            name: 'Valid MP4 URL',
            data: { videoUrl: 'https://example.com/video.mp4' }
        },
        {
            name: 'Missing videoUrl',
            data: {}
        },
        {
            name: 'Invalid URL',
            data: { videoUrl: 'not-a-url' }
        },
        {
            name: 'Unsupported domain',
            data: { videoUrl: 'https://unsupported.com/video.mp4' }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log(`Data: ${JSON.stringify(testCase.data)}`);
        
        try {
            const result = await makeRequest(testCase.data);
            console.log(`✅ Status: ${result.statusCode}`);
            console.log(`📄 Response: ${JSON.stringify(result.data, null, 2)}`);
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function makeRequest(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: DOMAIN,
            port: 443,
            path: '/api/extract-audio',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Test Script'
            }
        };
        
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
        
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.write(postData);
        req.end();
    });
}

testExtractAudio().catch(console.error);
