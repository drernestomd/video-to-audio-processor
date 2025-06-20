#!/bin/bash

echo "🚀 Deploying video-to-audio processor to Render..."

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml not found!"
    exit 1
fi

echo "📋 Render configuration:"
cat render.yaml

echo ""
echo "🌐 To deploy to Render:"
echo "1. Go to https://render.com"
echo "2. Connect your GitHub repository"
echo "3. Create a new Web Service"
echo "4. Use the render.yaml configuration"
echo "5. Set environment variables:"
echo "   - NODE_ENV=production"
echo "   - PORT=10000"
echo "   - PROCESSING_SERVICE_TOKEN=railway_secure_token_2024_vta_api"

echo ""
echo "📝 Or use Render CLI if installed:"
echo "render deploy"

echo ""
echo "✅ Once deployed, update Vercel environment variable:"
echo "RENDER_PROCESSING_URL=https://your-render-app.onrender.com"
