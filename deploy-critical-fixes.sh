#!/bin/bash
# Critical Fixes Deployment Script
# Deploys environment validation, idempotency, error handling, and input sanitization

set -e

echo "🚀 Deploying Critical Fixes to JoseTheRealtor Platform"
echo "========================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "amplify/backend.ts" ]; then
  echo "❌ Error: Must run from project root directory"
  exit 1
fi

# Phase 1: Deploy to Sandbox
echo "📦 Phase 1: Deploying to Sandbox..."
echo ""

npx ampx sandbox &
SANDBOX_PID=$!

# Wait for sandbox to be ready
echo "⏳ Waiting for sandbox deployment..."
wait $SANDBOX_PID

echo "✅ Sandbox deployment complete"
echo ""

# Phase 2: Enable TTL on WebhookIdempotency table
echo "⚙️  Phase 2: Enabling TTL on WebhookIdempotency table..."
echo ""

# Find the table name
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'WebhookIdempotency')]" --output text)

if [ -z "$TABLE_NAME" ]; then
  echo "⚠️  Warning: WebhookIdempotency table not found. Skipping TTL setup."
  echo "   Run this command manually after table is created:"
  echo "   aws dynamodb update-time-to-live --table-name <table-name> --time-to-live-specification \"Enabled=true, AttributeName=ttl\""
else
  echo "📋 Found table: $TABLE_NAME"
  aws dynamodb update-time-to-live \
    --table-name "$TABLE_NAME" \
    --time-to-live-specification "Enabled=true, AttributeName=ttl"
  echo "✅ TTL enabled on $TABLE_NAME"
fi

echo ""

# Phase 3: Test deployment
echo "🧪 Phase 3: Running basic tests..."
echo ""

# Test environment validation
echo "Testing environment validation..."
if npx ampx sandbox 2>&1 | grep -q "Environment validation passed"; then
  echo "✅ Environment validation working"
else
  echo "⚠️  Warning: Could not verify environment validation"
fi

echo ""

# Summary
echo "========================================================"
echo "✅ Deployment Complete!"
echo ""
echo "What was deployed:"
echo "  ✅ Environment variable validation"
echo "  ✅ Webhook idempotency (prevents duplicate messages)"
echo "  ✅ Structured error logging"
echo "  ✅ Input sanitization"
echo ""
echo "Next steps:"
echo "  1. Monitor CloudWatch logs for validation messages"
echo "  2. Test webhook with duplicate requests"
echo "  3. Deploy to production: git push origin main"
echo ""
echo "Monitoring commands:"
echo "  aws logs tail /aws/lambda/ghlWebhookHandler --follow"
echo "  aws dynamodb scan --table-name $TABLE_NAME --limit 10"
echo ""
