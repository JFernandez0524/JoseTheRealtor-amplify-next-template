#!/bin/bash

echo "🚀 Running bulk queue population with GHL MCP server..."
echo "📋 This will fetch ALL contacts with 'ai outreach' tag and add them to the queue"
echo ""

# Run the script with proper MCP environment
node bulk-populate-queue.js

echo ""
echo "✅ Bulk population complete!"
echo "💡 The queue now contains all your GHL contacts with 'ai outreach' tag"
echo "🤖 Your hourly agents will automatically process these contacts during business hours"
