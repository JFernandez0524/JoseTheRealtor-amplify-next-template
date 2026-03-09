#!/bin/bash

echo "🚀 GHL Sync Fix Testing Guide"
echo "=============================="
echo ""
echo "📋 Test Cases:"
echo ""
echo "1️⃣  SINGLE PHONE LEAD"
echo "   - Find a lead with 1 phone number"
echo "   - Sync to GHL from dashboard"
echo "   - Check CloudWatch logs for: '✅ Saved primary contactId'"
echo "   - Verify lead status = SUCCESS"
echo "   - Verify ghlContactId is saved"
echo ""
echo "2️⃣  MULTI-PHONE LEAD"
echo "   - Find a lead with 2+ phone numbers"
echo "   - Sync to GHL from dashboard"
echo "   - Check CloudWatch logs for: '✅ Saved primary contactId' after first phone"
echo "   - Even if second phone fails:"
echo "     • Lead status should be SUCCESS"
echo "     • ghlContactId should be saved (first phone's ID)"
echo "     • Log should show: '⚠️ Error syncing additional phones, but primary contact X was saved'"
echo ""
echo "3️⃣  EMAIL-ONLY LEAD"
echo "   - Find a lead with no phones, only email"
echo "   - Sync to GHL from dashboard"
echo "   - Check CloudWatch logs for: '✅ Saved contactId'"
echo "   - Verify lead status = SUCCESS"
echo "   - Verify ghlContactId is saved"
echo ""
echo "📊 CloudWatch Log Queries:"
echo ""
echo "# Find immediate saves:"
echo 'fields @timestamp, @message'
echo '| filter @message like /Saved primary contactId|Saved contactId/'
echo '| sort @timestamp desc'
echo '| limit 20'
echo ""
echo "# Find graceful degradation:"
echo 'fields @timestamp, @message'
echo '| filter @message like /Error syncing additional phones, but primary contact/'
echo '| sort @timestamp desc'
echo '| limit 20'
echo ""
echo "🔍 To check database after sync:"
echo 'aws dynamodb get-item \'
echo '  --table-name "PropertyLead-<your-table-suffix>" \'
echo '  --key '"'"'{"id": {"S": "<lead-id>"}}'"'"' \'
echo '  --query '"'"'Item.{id:id.S,status:ghlSyncStatus.S,contactId:ghlContactId.S}'"'"
echo ""
echo "✅ Success Criteria:"
echo "   • No FAILED status when contact exists in GHL"
echo "   • ghlContactId saved even if queue operations fail"
echo "   • CloudWatch shows 'Saved contactId' messages"
echo "   • Multi-phone leads save primary before processing additional phones"
echo ""
