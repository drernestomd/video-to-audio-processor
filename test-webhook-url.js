// Test webhook URL construction
console.log('Testing webhook URL construction...');

// Simulate Vercel environment
const mockVercelUrl1 = 'video-to-audio-hmbj9qg1p-ernestos-projects-e9a7d5c3.vercel.app';
const mockVercelUrl2 = 'https://video-to-audio-hmbj9qg1p-ernestos-projects-e9a7d5c3.vercel.app';

console.log('\nTest 1 - VERCEL_URL without https://');
const webhookUrl1 = `https://${mockVercelUrl1}/api/webhook/processing-complete`;
console.log('Webhook URL:', webhookUrl1);

console.log('\nTest 2 - VERCEL_URL with https://');
const webhookUrl2 = `https://${mockVercelUrl2}/api/webhook/processing-complete`;
console.log('Webhook URL:', webhookUrl2);

console.log('\nTest 3 - URL validation');
try {
  new URL(webhookUrl1);
  console.log('webhookUrl1 is valid');
} catch (e) {
  console.log('webhookUrl1 is INVALID:', e.message);
}

try {
  new URL(webhookUrl2);
  console.log('webhookUrl2 is valid');
} catch (e) {
  console.log('webhookUrl2 is INVALID:', e.message);
}
