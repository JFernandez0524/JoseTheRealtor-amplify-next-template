# Testing Guide - CSV Upload Progress Modal

## Quick Test

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to upload page:**
   - Go to http://localhost:3000/upload
   - Switch to "CSV Import" tab

3. **Prepare test CSV:**
   - Download the template (Probate or Preforeclosure)
   - Add 20-50 rows of test data
   - Save as `test-leads.csv`

4. **Upload and observe:**
   - Select lead type
   - Choose your test CSV file
   - Click "Start CSV Import"
   - **Expected:** Modal appears immediately
   - **Expected:** Progress bar updates every few seconds
   - **Expected:** Success/Duplicate/Error counts update
   - **Expected:** Automatic redirect to dashboard when complete

## Test Scenarios

### Scenario 1: Small Upload (10 rows)
**Purpose:** Verify basic functionality

1. Create CSV with 10 valid leads
2. Upload and watch modal
3. **Expected:** 
   - Modal shows "0 of 10 rows" initially
   - Updates to "10 of 10 rows" quickly
   - Redirects to dashboard within 5-10 seconds
   - All 10 leads visible on dashboard

### Scenario 2: Medium Upload (100 rows)
**Purpose:** Verify progress updates

1. Create CSV with 100 valid leads
2. Upload and watch modal
3. **Expected:**
   - Progress bar animates smoothly
   - Updates every 10 rows (10%, 20%, 30%, etc.)
   - Takes 30-60 seconds to complete
   - Immediate redirect on completion

### Scenario 3: Upload with Duplicates
**Purpose:** Verify duplicate detection

1. Upload CSV with 50 leads
2. Wait for completion
3. Upload same CSV again
4. **Expected:**
   - Modal shows high duplicate count
   - Success count is 0 (all duplicates)
   - Duplicate count is 50

### Scenario 4: Upload with Invalid Data
**Purpose:** Verify error handling

1. Create CSV with some invalid addresses
2. Upload and watch modal
3. **Expected:**
   - Error count increases for invalid rows
   - Success count shows only valid rows
   - Modal still completes and redirects

### Scenario 5: Large Upload (500+ rows)
**Purpose:** Verify performance and no throttling

1. Create CSV with 500+ leads
2. Upload and watch modal
3. **Expected:**
   - Progress updates consistently every 10 rows
   - No errors or timeouts
   - Completes successfully (may take 5-10 minutes)

### Scenario 6: Failed Upload
**Purpose:** Verify error state

1. Upload CSV with completely invalid format
2. **Expected:**
   - Modal shows "Upload Failed" state
   - Error message displayed
   - "Try Again" button appears
   - Clicking button returns to upload page

## Debugging

### Check Lambda Logs
```bash
# View CloudWatch logs for uploadCsvHandler
aws logs tail /aws/lambda/uploadCsvHandler --follow
```

### Check DynamoDB Records
```bash
# Query CsvUploadJob table
aws dynamodb scan --table-name CsvUploadJob-[env] --limit 10
```

### Check Browser Console
- Open DevTools (F12)
- Watch for polling requests every 2 seconds
- Check for any JavaScript errors

## Common Issues

### Issue: Modal shows "Initializing..." forever
**Cause:** Lambda didn't find the job record
**Fix:** Check that fileName matches exactly between frontend and S3

### Issue: Progress never updates
**Cause:** Lambda not updating job progress
**Fix:** Check Lambda logs for errors, verify DynamoDB permissions

### Issue: Modal doesn't redirect
**Cause:** Job status never changes to COMPLETED
**Fix:** Check Lambda logs, verify job completion logic

### Issue: Duplicate job records created
**Cause:** Race condition between frontend and Lambda
**Fix:** Ensure Lambda queries for PENDING status only

## Performance Benchmarks

| Rows | Expected Time | Progress Updates |
|------|---------------|------------------|
| 10   | 5-10 sec      | 1 update         |
| 50   | 15-30 sec     | 5 updates        |
| 100  | 30-60 sec     | 10 updates       |
| 500  | 3-5 min       | 50 updates       |
| 1000 | 5-10 min      | 100 updates      |

*Times vary based on API rate limits (Google, Bridge API)*

## Success Criteria

✅ Modal appears immediately after clicking upload
✅ Progress bar shows accurate percentage
✅ Row counts update in real-time
✅ Success/Duplicate/Error counts are accurate
✅ Redirect happens immediately on completion (no delay)
✅ Modal cannot be dismissed during processing
✅ Error state shows retry option
✅ Multiple uploads don't interfere with each other
✅ Large uploads (500+ rows) complete without errors
✅ Dashboard shows all uploaded leads after redirect
