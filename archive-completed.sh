#!/bin/bash

# Archive completed documentation and scripts
# Run this after implementations are complete and deployed

echo "📦 Archiving completed implementations..."

# Create archive directories
mkdir -p docs/archive/completed/2026-03
mkdir -p scripts/archive/2026-03

# Move completed docs
mv docs/AI_EMAIL_OUTREACH_FIX_2026-03-10.md docs/archive/completed/2026-03/
mv docs/GHL_SYNC_FIX_2026-03-09.md docs/archive/completed/2026-03/
mv docs/AI_MANUAL_INTERVENTION_IMPLEMENTATION.md docs/archive/completed/2026-03/
mv docs/AI_MANUAL_INTERVENTION_TESTING.md docs/archive/completed/2026-03/

# Move completed scripts
mv scripts/backfill-ai-outreach.js scripts/archive/2026-03/
mv scripts/backfill-ai-outreach.ts scripts/archive/2026-03/

# Move other completed one-time scripts
mv scripts/fix-next-email-date.ts scripts/archive/2026-03/
mv scripts/backfill-leadid.ts scripts/archive/2026-03/
mv scripts/fix-queue-status.ts scripts/archive/2026-03/
mv scripts/tag-status-contacts.ts scripts/archive/2026-03/
mv scripts/set-listing-status.ts scripts/archive/2026-03/
mv scripts/fix-email-counters.ts scripts/archive/2026-03/
mv scripts/clean-queue.ts scripts/archive/2026-03/
mv scripts/migrate-listing-status.ts scripts/archive/2026-03/
mv scripts/fix-email.ts scripts/archive/2026-03/
mv scripts/check-wrong-emails.ts scripts/archive/2026-03/
mv scripts/check-queue.ts scripts/archive/2026-03/
mv scripts/remove-from-queue.ts scripts/archive/2026-03/
mv scripts/fix-orphaned-leads.ts scripts/archive/2026-03/
mv scripts/recover-skiptrace-data.ts scripts/archive/2026-03/
mv scripts/fix-zestimate-dates.ts scripts/archive/2026-03/

echo "✅ Archive complete!"
echo ""
echo "Archived:"
echo "  - 4 documentation files → docs/archive/completed/2026-03/"
echo "  - 17 script files → scripts/archive/2026-03/"
