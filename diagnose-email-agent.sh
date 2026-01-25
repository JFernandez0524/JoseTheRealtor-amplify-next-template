#!/bin/bash
# Email Agent Diagnostic Script

echo "=== EMAIL AGENT DIAGNOSTICS ==="
echo ""

echo "1. Checking if dailyEmailAgent Lambda exists..."
aws lambda get-function --function-name dailyEmailAgent --region us-east-1 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Lambda function exists"
else
  echo "❌ Lambda function NOT found"
fi
echo ""

echo "2. Checking recent Lambda invocations (last 24 hours)..."
aws logs tail /aws/lambda/dailyEmailAgent --since 24h --region us-east-1 --format short 2>/dev/null | head -50
echo ""

echo "3. Checking EventBridge schedule..."
aws events list-rules --region us-east-1 --query "Rules[?contains(Name, 'dailyEmailAgent')]" 2>/dev/null
echo ""

echo "4. Checking GHL integrations with campaign email..."
aws dynamodb scan \
  --table-name GhlIntegration-* \
  --filter-expression "attribute_exists(campaignEmail)" \
  --projection-expression "userId,campaignEmail,locationId" \
  --region us-east-1 2>/dev/null
echo ""

echo "5. Checking OutreachQueue for pending emails..."
aws dynamodb scan \
  --table-name OutreachQueue-* \
  --filter-expression "emailStatus = :pending AND emailAttempts < :max" \
  --expression-attribute-values '{":pending":{"S":"PENDING"},":max":{"N":"7"}}' \
  --select COUNT \
  --region us-east-1 2>/dev/null
echo ""

echo "=== DIAGNOSTIC COMPLETE ==="
