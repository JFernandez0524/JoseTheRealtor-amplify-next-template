# CSV Upload Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS CSV FILE                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (ManualLeadForm.tsx)                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  1. Create CsvUploadJob record                                      │
│     - status: PENDING                                               │
│     - fileName: "leads.csv"                                         │
│     - userId: current user                                          │
│     - Get jobId from created record                                 │
│                                                                      │
│  2. Upload file to S3                                               │
│     - path: leadFiles/{userId}/{fileName}                           │
│     - metadata: { leadtype, owner_sub }                             │
│                                                                      │
│  3. Show UploadProgressModal                                        │
│     - Pass jobId to modal                                           │
│     - Modal starts polling job status                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  S3 TRIGGER → LAMBDA (uploadCsvHandler)                             │
│  ─────────────────────────────────────────────────────────────────  │
│  1. Find existing job record                                        │
│     - Query by userId + fileName + status=PENDING                   │
│                                                                      │
│  2. Update job status to PROCESSING                                 │
│                                                                      │
│  3. Count total rows in CSV                                         │
│     - Read CSV once to count                                        │
│     - Update job.totalRows                                          │
│                                                                      │
│  4. Process CSV rows                                                │
│     - For each row:                                                 │
│       • Validate address with Google                                │
│       • Fetch Zestimate from Bridge API                             │
│       • Check for duplicates                                        │
│       • Calculate AI score (preforeclosure only)                    │
│       • Save to PropertyLead table                                  │
│       • Increment success/duplicate count                           │
│                                                                      │
│     - Every 10 rows:                                                │
│       • Update job.processedRows                                    │
│       • Update job.successCount                                     │
│       • Update job.duplicateCount                                   │
│                                                                      │
│  5. Complete processing                                             │
│     - Update job status to COMPLETED                                │
│     - Set final counts (success, duplicate, error)                  │
│     - Delete S3 file                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MODAL (UploadProgressModal.tsx)                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  Polling every 2 seconds:                                           │
│                                                                      │
│  1. Query CsvUploadJob by jobId                                     │
│                                                                      │
│  2. Display progress:                                               │
│     ┌─────────────────────────────────────────────────┐            │
│     │  Processing Upload                              │            │
│     │  leads.csv                                      │            │
│     │                                                  │            │
│     │  Progress                              75%      │            │
│     │  ████████████████████░░░░░░░░          │            │
│     │  75 of 100 rows processed                       │            │
│     │                                                  │            │
│     │  ┌──────────┬──────────┬──────────┐            │            │
│     │  │    68    │    5     │    2     │            │            │
│     │  │ Success  │Duplicates│  Errors  │            │            │
│     │  └──────────┴──────────┴──────────┘            │            │
│     │                                                  │            │
│     │           ⟳ Loading...                          │            │
│     └─────────────────────────────────────────────────┘            │
│                                                                      │
│  3. When status === 'COMPLETED':                                    │
│     - Immediately call router.push('/dashboard')                    │
│                                                                      │
│  4. When status === 'FAILED':                                       │
│     - Show error message                                            │
│     - Show "Try Again" button                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REDIRECT TO DASHBOARD                             │
│                    (New leads visible)                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Timeline Example (100 row CSV)

```
Time    Event                                   Modal Display
─────────────────────────────────────────────────────────────────────
0s      User clicks "Start CSV Import"          Button shows "Processing..."
0.5s    Job created (PENDING)                   Modal appears: "Initializing..."
1s      File uploaded to S3                     Modal: "Initializing..."
1.5s    Lambda triggered                        Modal: "Initializing..."
2s      Lambda finds job, sets PROCESSING       Modal: "Initializing..."
3s      Lambda counts rows (totalRows=100)      Modal polls: "0 of 100 rows"
4s      Lambda processes rows 1-10              Modal: "0 of 100 rows"
5s      Lambda updates progress                 Modal polls: "10 of 100 rows (10%)"
7s      Lambda processes rows 11-20             Modal: "10 of 100 rows"
8s      Lambda updates progress                 Modal polls: "20 of 100 rows (20%)"
...     (continues every ~3 seconds)            Progress bar animates
30s     Lambda processes rows 91-100            Modal: "90 of 100 rows (90%)"
31s     Lambda sets COMPLETED                   Modal: "90 of 100 rows"
32s     Modal polls, detects COMPLETED          Immediately redirects
32s     User sees dashboard with new leads      ✓ Upload complete!
```

## Key Features

✅ **Real-time progress** - Updates every 10 rows processed
✅ **Accurate percentage** - Based on totalRows count
✅ **Detailed statistics** - Success, duplicate, and error counts
✅ **Immediate redirect** - No delay after completion
✅ **Error handling** - Shows error message with retry option
✅ **Cannot dismiss** - Modal blocks navigation during processing
✅ **Professional UX** - Loading animations and smooth transitions
