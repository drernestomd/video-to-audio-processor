#!/bin/bash

echo "🚀 Railway Deployment Script"
echo "============================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    echo "Please install Railway CLI first:"
    echo "npm install -g @railway/cli"
    echo "or"
    echo "curl -fsSL https://railway.app/install.sh | sh"
    exit 1
fi

echo "✅ Railway CLI found"

# Navigate to railway-processor directory
cd railway-processor

echo "📁 Current directory: $(pwd)"
echo "📋 Files in directory:"
ls -la

# Login to Railway (if not already logged in)
echo ""
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway:"
    railway login
fi

echo "✅ Railway authentication confirmed"

# Initialize Railway project
echo ""
echo "🚀 Initializing Railway project..."
railway init

# Set environment variables
echo ""
echo "⚙️  Setting environment variables..."
railway variables set PROCESSING_SERVICE_TOKEN=railway_secure_token_2024_vta_api
railway variables set NODE_ENV=production
railway variables set PORT=3001

# Deploy the service
echo ""
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📋 Next steps:"
echo "1. Wait for deployment to complete"
echo "2. Get your Railway URL from the dashboard"
echo "3. Update Vercel environment variables:"
echo "   - RAILWAY_PROCESSING_URL=https://your-app.railway.app"
echo "4. Redeploy Vercel"
echo ""
echo "🌐 Railway Dashboard: https://railway.app/dashboard"
