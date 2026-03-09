#!/bin/bash

echo "🔍 Quick GHL Sync Test"
echo "====================="
echo ""

# Get the DynamoDB table name
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'PropertyLead')]" --output text | head -1)

if [ -z "$TABLE_NAME" ]; then
  echo "❌ Could not find PropertyLead table"
  exit 1
fi

echo "📊 Using table: $TABLE_NAME"
echo ""

# Find a lead to test with
echo "🔎 Finding a test lead..."
LEAD=$(aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --filter-expression "attribute_exists(ownerPhone1) AND ghlSyncStatus <> :synced" \
  --expression-attribute-values '{":synced": {"S": "SUCCESS"}}' \
  --limit 1 \
  --query 'Items[0].{id:id.S,name:ownerFirstName.S,phone:ownerPhone1.S,status:ghlSyncStatus.S}' \
  --output json)

if [ "$LEAD" == "null" ] || [ -z "$LEAD" ]; then
  echo "❌ No unsynced leads found with phone numbers"
  echo ""
  echo "💡 Try one of these:"
  echo "   1. Upload new leads via dashboard"
  echo "   2. Reset a synced lead's status to test"
  echo "   3. Use the dashboard to manually sync a lead"
  exit 0
fi

echo "✅ Found test lead:"
echo "$LEAD" | jq .
echo ""

LEAD_ID=$(echo "$LEAD" | jq -r .id)

echo "📝 Instructions:"
echo "   1. Go to your dashboard: http://localhost:3000"
echo "   2. Find lead: $LEAD_ID"
echo "   3. Click 'Sync to GHL' button"
echo "   4. Watch the terminal for function logs (already streaming)"
echo "   5. Look for: '✅ Saved primary contactId'"
echo ""
echo "🔍 After sync, check the result:"
echo "   aws dynamodb get-item \\"
echo "     --table-name \"$TABLE_NAME\" \\"
echo "     --key '{\"id\": {\"S\": \"$LEAD_ID\"}}' \\"
echo "     --query 'Item.{id:id.S,status:ghlSyncStatus.S,contactId:ghlContactId.S}'"
echo ""
