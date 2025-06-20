const https = require('https');
const http = require('http');

// Replace with your actual Vercel domain
const VERCEL_DOMAIN = 'video-to-audio-puwveu8zj-ernestos-projects-e9a7d5c3.vercel.app'; // Your actual Vercel domain

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testEndpoint(domain, path, description, method = 'GET', data = null) {
    return new Promise((resolve) => {
        const isHttps = domain.includes('vercel.app') || domain.includes('https://');
        const protocol = isHttps ? https : http;
        const port = isHttps ? 443 : 80;
        
        // Clean domain
        const cleanDomain = domain.replace(/^https?:\/\//, '');
        
        const options = {
            hostname: cleanDomain,
            port: port,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Node.js Deployment Test',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        if (data && method === 'POST') {
            const postData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        log(`\n🧪 Testing ${description}...`, 'blue');
        log(`${method} https://${cleanDomain}${path}`, 'yellow');

        const req = protocol.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                const statusCode = res.statusCode;
                log(`Status: ${statusCode}`, statusCode < 400 ? 'green' : 'red');
                
                // Show important headers
                const importantHeaders = ['content-type', 'x-vercel-id', 'x-vercel-cache', 'server'];
                importantHeaders.forEach(header => {
                    if (res.headers[header]) {
                        log(`${header}: ${res.headers[header]}`, 'yellow');
                    }
                });
                
                if (statusCode === 200) {
                    log(`✅ ${description} - SUCCESS`, 'green');
                    try {
                        const parsed = JSON.parse(responseData);
                        log(`Response preview:`, 'blue');
                        console.log(JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        log(`Response (first 200 chars): ${responseData.substring(0, 200)}`, 'blue');
                    }
                } else if (statusCode === 404) {
                    log(`❌ ${description} - NOT FOUND (Function may not be deployed)`, 'red');
                } else if (statusCode === 405) {
                    log(`⚠️  ${description} - Method not allowed (but endpoint exists!)`, 'yellow');
                } else if (statusCode >= 500) {
                    log(`❌ ${description} - SERVER ERROR`, 'red');
                    log(`Error response: ${responseData}`, 'red');
                } else {
                    log(`⚠️  ${description} - Status ${statusCode}`, 'yellow');
                    log(`Response: ${responseData.substring(0, 200)}`, 'yellow');
                }
                resolve({ statusCode, responseData, headers: res.headers });
            });
        });

        req.on('error', (error) => {
            log(`❌ ${description} - CONNECTION ERROR: ${error.message}`, 'red');
            if (error.code === 'ENOTFOUND') {
                log(`   Domain "${cleanDomain}" not found. Check your domain name.`, 'red');
            } else if (error.code === 'ECONNREFUSED') {
                log(`   Connection refused. Service may be down.`, 'red');
            }
            resolve({ error: error.message });
        });

        req.setTimeout(15000, () => {
            log(`❌ ${description} - TIMEOUT (15s)`, 'red');
            req.destroy();
            resolve({ error: 'timeout' });
        });

        if (data && method === 'POST') {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function checkDeploymentStatus() {
    log('🚀 Vercel Deployment Status Check', 'bold');
    log('=====================================', 'bold');
    
    if (VERCEL_DOMAIN === 'your-project.vercel.app') {
        log('❌ ERROR: Please update VERCEL_DOMAIN with your actual domain!', 'red');
        log('   Edit this file and replace "your-project.vercel.app" with your real domain', 'yellow');
        return;
    }
    
    log(`Testing domain: ${VERCEL_DOMAIN}`, 'blue');
    
    const tests = [
        // Test 1: Health check endpoint
        {
            path: '/api/health',
            description: 'Health Check Endpoint',
            method: 'GET'
        },
        
        // Test 2: Extract audio endpoint (should return 405 for GET)
        {
            path: '/api/extract-audio',
            description: 'Extract Audio Endpoint (GET - should be 405)',
            method: 'GET'
        },
        
        // Test 3: Status endpoint with dummy ID
        {
            path: '/api/status/test-job-id',
            description: 'Status Endpoint',
            method: 'GET'
        },
        
        // Test 4: Download endpoint with dummy ID
        {
            path: '/api/download/test-job-id',
            description: 'Download Endpoint',
            method: 'GET'
        },
        
        // Test 5: Webhook endpoint
        {
            path: '/api/webhook/processing-complete',
            description: 'Webhook Endpoint',
            method: 'GET'
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        const result = await testEndpoint(VERCEL_DOMAIN, test.path, test.description, test.method, test.data);
        results.push({ ...test, result });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    log('\n📋 DEPLOYMENT SUMMARY', 'bold');
    log('====================', 'bold');
    
    const workingEndpoints = results.filter(r => r.result.statusCode && r.result.statusCode < 500);
    const errorEndpoints = results.filter(r => r.result.error || (r.result.statusCode && r.result.statusCode >= 500));
    const notFoundEndpoints = results.filter(r => r.result.statusCode === 404);
    
    log(`✅ Working endpoints: ${workingEndpoints.length}/${results.length}`, 'green');
    log(`❌ Error endpoints: ${errorEndpoints.length}/${results.length}`, errorEndpoints.length > 0 ? 'red' : 'green');
    log(`🔍 Not found endpoints: ${notFoundEndpoints.length}/${results.length}`, notFoundEndpoints.length > 0 ? 'yellow' : 'green');
    
    // Check if any endpoint responded with Vercel headers
    const vercelResponses = results.filter(r => r.result.headers && (
        r.result.headers['x-vercel-id'] || 
        r.result.headers['server']?.includes('Vercel') ||
        r.result.headers['x-vercel-cache']
    ));
    
    if (vercelResponses.length > 0) {
        log(`✅ Vercel deployment detected (${vercelResponses.length} endpoints show Vercel headers)`, 'green');
    } else {
        log(`⚠️  No Vercel headers detected - check if domain is correctly configured`, 'yellow');
    }
    
    log('\n🔧 TROUBLESHOOTING TIPS:', 'bold');
    
    if (errorEndpoints.length > 0) {
        log('• Check Vercel dashboard for deployment errors', 'yellow');
        log('• Verify environment variables are set', 'yellow');
        log('• Check function logs in Vercel dashboard', 'yellow');
    }
    
    if (notFoundEndpoints.length > 0) {
        log('• Some API routes may not be deployed correctly', 'yellow');
        log('• Check if your pages/api/ structure matches the expected paths', 'yellow');
    }
    
    if (results.every(r => r.result.error)) {
        log('• Domain may not be reachable - check DNS configuration', 'red');
        log('• Verify the domain name is correct', 'red');
        log('• Check if deployment is actually live in Vercel dashboard', 'red');
    }
    
    log('\n📖 NEXT STEPS:', 'bold');
    log('1. Update the VERCEL_DOMAIN variable in this script with your actual domain', 'blue');
    log('2. Check your Vercel dashboard at https://vercel.com/dashboard', 'blue');
    log('3. Look for deployment status, build logs, and function logs', 'blue');
    log('4. Verify environment variables are configured', 'blue');
    log('5. Test the health endpoint in your browser: https://your-domain.vercel.app/api/health', 'blue');
}

// Run the tests
checkDeploymentStatus().catch(console.error);
