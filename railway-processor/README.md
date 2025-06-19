# Video-to-Audio Processing Service

Fast video-to-audio conversion service using native FFmpeg for Railway deployment.

## Features

- Native FFmpeg processing (fast)
- Webhook integration for status updates
- Support for various video formats
- MP3 audio output
- Health monitoring endpoint

## Environment Variables

Required:
- `PROCESSING_SERVICE_TOKEN` - Authentication token
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (production/development)

## Endpoints

- `GET /health` - Health check
- `POST /process` - Process video to audio

## Deployment

This service is designed to be deployed on Railway and integrated with the main Vercel API.

## Usage

The service receives video processing requests from the main API and sends status updates via webhooks.
