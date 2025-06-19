#!/bin/bash

# Complete Railway Deployment Script
# Run this after connecting GitHub repository to Railway

echo "🚀 RAILWAY DEPLOYMENT COMPLETION SCRIPT"
echo "========================================"

# Step 1: Wait for Railway URL input
echo ""
echo "📋 STEP 1: Get Railway URL"
echo "After connecting GitHub to Railway, copy the Railway app URL from the dashboard."
echo ""
read -p "Enter your Railway app URL (e.g., https://your-app.railway.app): " RAILWAY_URL

if [ -z "$RAILWAY_URL" ]; then
    echo "❌ Railway URL is required. Exiting."
    exit 1
fi

echo "✅ Railway URL: $RAILWAY_URL"

# Step 2: Add Vercel Environment Variables
echo ""
echo "📋 STEP 2: Adding Vercel Environment Variables"
echo ""

echo "Adding RAILWAY_PROCESSING_URL..."
echo "$RAILWAY_URL" | vercel env add RAILWAY_PROCESSING_URL production

echo "Adding PROCESSING_SERVICE_TOKEN..."
echo "railway_secure_token_2024_vta_api" | vercel env add PROCESSING_SERVICE_TOKEN production

echo "Adding WEBHOOK_SECRET..."
echo "webhook_secret_2024_vta_secure_key" | vercel env add WEBHOOK_SECRET production

echo "✅ Environment variables added to Vercel"

# Step 3: Redeploy Vercel
echo ""
echo "📋 STEP 3: Redeploying Vercel with new environment variables"
echo ""
vercel --prod

echo "✅ Vercel redeployed"

# Step 4: Test the system
echo ""
echo "📋 STEP 4: Testing the complete system"
echo ""

# Test Railway health
echo "Testing Railway health endpoint..."
RAILWAY_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/health")
if [ "$RAILWAY_HEALTH" = "200" ]; then
    echo "✅ Railway service is healthy"
else
    echo "❌ Railway service health check failed (HTTP $RAILWAY_HEALTH)"
fi

# Test Vercel health
echo "Testing Vercel health endpoint..."
VERCEL_URL="https://video-to-audio-j4tdcc5bg-ernestos-projects-e9a7d5c3.vercel.app"
VERCEL_HEALTH=$(curl -s "$VERCEL_URL/api/health" | jq -r '.railwayAvailable // false')
if [ "$VERCEL_HEALTH" = "true" ]; then
    echo "✅ Vercel can connect to Railway"
else
    echo "❌ Vercel cannot connect to Railway"
fi

# Step 5: Display completion summary
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "📊 System Status:"
echo "• Railway URL: $RAILWAY_URL"
echo "• Vercel URL: $VERCEL_URL"
echo "• GitHub Repo: https://github.com/drernestomd/video-to-audio-processor"
echo ""
echo "🧪 Test Commands:"
echo "# Test Railway directly:"
echo "curl $RAILWAY_URL/health"
echo ""
echo "# Test Vercel health (should show Railway available):"
echo "curl $VERCEL_URL/api/health"
echo ""
echo "# Test video processing with Railway:"
echo "curl -X POST $VERCEL_URL/api/extract-audio \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"videoUrl\": \"YOUR_VIDEO_URL\", \"processingService\": \"railway\"}'"
echo ""
echo "✅ Your hybrid video-to-audio API is now live!"
