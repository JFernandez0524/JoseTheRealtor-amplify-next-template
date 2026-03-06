# Quick Reference - Critical Fixes

## 🚀 Deploy
```bash
./deploy-critical-fixes.sh
```

## 🧪 Test Idempotency
```bash
WEBHOOK_ID="test-$(date +%s)"
curl -X POST https://your-webhook-url -H "x-ghl-webhook-id: $WEBHOOK_ID" -d '{"type":"InboundMessage","contactId":"test","customData":{"userId":"test","messageBody":"hi"}}'
sleep 1
curl -X POST https://your-webhook-url -H "x-ghl-webhook-id: $WEBHOOK_ID" -d '{"type":"InboundMessage","contactId":"test","customData":{"userId":"test","messageBody":"hi"}}'
# Second call should return "Already processed"
```

## 📊 Monitor
```bash
# Watch logs
aws logs tail /aws/lambda/ghlWebhookHandler --follow

# Check idempotency table
aws dynamodb scan --table-name $(aws dynamodb list-tables --query "TableNames[?contains(@, 'WebhookIdempotency')]" --output text) --limit 10

# Check for errors
aws logs filter-log-events --log-group-name /aws/lambda/ghlWebhookHandler --filter-pattern "ERROR" --max-items 10
```

## ✅ What Was Fixed
1. **Environment Validation** - Fails fast if env vars missing
2. **Webhook Idempotency** - Prevents duplicate messages
3. **Error Logging** - JSON logs with full context
4. **Input Sanitization** - Prevents DynamoDB errors

## 📦 New Files
- `amplify/functions/shared/config.ts`
- `amplify/functions/shared/idempotency.ts`
- `amplify/functions/shared/logger.ts`
- `amplify/functions/shared/sanitize.ts`

## 🔧 Modified Files
- `amplify/functions/ghlWebhookHandler/handler.ts`
- `amplify/data/resource.ts`
- `amplify/backend.ts`

## 🎯 Success Metrics (24 hours)
- Zero "Missing env var" errors
- Duplicate message rate < 0.1%
- Webhook success rate > 99%
- Zero DynamoDB validation errors

## 🔄 Rollback
```bash
git revert HEAD
git push origin main
```

## 📚 Full Documentation
- `CRITICAL_FIXES_COMPLETE.md` - Complete guide
- `IMPLEMENTATION_SUMMARY.md` - What was implemented
- `IMPLEMENTATION_STATUS.md` - Updated status
