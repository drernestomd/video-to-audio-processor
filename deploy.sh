#!/bin/bash

# Video-to-Audio API Deployment Script
# This script automates the deployment process to Vercel

set -e  # Exit on any error

echo "🚀 Starting Video-to-Audio API Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if this is the video-to-audio-api project
if ! grep -q "video-to-audio-api" package.json; then
    print_error "This doesn't appear to be the video-to-audio-api project."
    exit 1
fi

print_status "Validating project structure..."

# Check for required files
required_files=(
    "pages/api/extract-audio.js"
    "pages/api/status/[jobId].js"
    "pages/api/download/[jobId].js"
    "pages/api/health.js"
    "lib/jobs.js"
    "lib/ffmpeg.js"
    "lib/ffmpeg-wasm.js"
    "utils/download.js"
    "vercel.json"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done

print_success "Project structure validated"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_warning "Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check for environment variables
print_status "Checking environment configuration..."

if [ ! -f ".env.local" ] && [ -z "$BLOB_READ_WRITE_TOKEN" ]; then
    print_warning "No .env.local file found and BLOB_READ_WRITE_TOKEN not set"
    print_warning "You'll need to configure environment variables in Vercel dashboard"
fi

# Run security audit
print_status "Running security audit..."
if npm audit --audit-level high; then
    print_success "No high-severity vulnerabilities found"
else
    print_warning "Security vulnerabilities detected. Consider running 'npm audit fix'"
fi

# Build the project locally to check for errors
print_status "Building project locally..."
if npm run build; then
    print_success "Local build successful"
else
    print_error "Local build failed. Please fix errors before deploying."
    exit 1
fi

# Deploy to Vercel
print_status "Deploying to Vercel..."

# Check if this is the first deployment
if [ ! -f ".vercel/project.json" ]; then
    print_status "First deployment detected. Running initial setup..."
    vercel --confirm
else
    print_status "Deploying to existing project..."
    vercel --prod
fi

# Get deployment URL
DEPLOYMENT_URL=$(vercel ls --scope=$(vercel whoami) | grep video-to-audio-api | head -1 | awk '{print $2}')

if [ -n "$DEPLOYMENT_URL" ]; then
    print_success "Deployment completed!"
    echo ""
    echo "🌐 Your API is now live at: https://$DEPLOYMENT_URL"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Set up environment variables in Vercel dashboard:"
    echo "   - BLOB_READ_WRITE_TOKEN (required)"
    echo ""
    echo "2. Test your deployment:"
    echo "   curl https://$DEPLOYMENT_URL/api/health"
    echo ""
    echo "3. Test video conversion:"
    echo "   curl -X POST https://$DEPLOYMENT_URL/api/extract-audio \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"videoUrl\": \"YOUR_VIDEO_URL\"}'"
    echo ""
    echo "📚 Documentation:"
    echo "   - README.md - API usage guide"
    echo "   - PRODUCTION_DEPLOYMENT.md - Detailed deployment guide"
    echo ""
    echo "🔧 Vercel Dashboard: https://vercel.com/dashboard"
else
    print_error "Could not determine deployment URL"
fi

# Check health endpoint
print_status "Testing health endpoint..."
if [ -n "$DEPLOYMENT_URL" ]; then
    sleep 5  # Wait for deployment to be ready
    if curl -s "https://$DEPLOYMENT_URL/api/health" > /dev/null; then
        print_success "Health endpoint is responding"
    else
        print_warning "Health endpoint not responding yet (this is normal for first deployment)"
    fi
fi

print_success "Deployment script completed! 🎉"
