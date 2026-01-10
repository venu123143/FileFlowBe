# Analytics System Implementation

## Overview
A comprehensive analytics system has been implemented for FileFlow to track user activity, storage usage, and file operations.

## Architecture

### 1. Queue System (`analytics-queue.ts`)
- **Queue Name**: `fileflow-analytics-queue`
- **Event Types**:
  - `FILE_UPLOADED` - Track file uploads
  - `FILE_DELETED` - Track file deletions
  - `FILE_DOWNLOADED` - Track file downloads
  - `FILE_SHARED` - Track file shares
  - `PUBLIC_LINK_CREATED` - Track public link creation
  - `FOLDER_CREATED` - Track folder creation

- **Configuration**:
  - 5 retry attempts with exponential backoff
  - Concurrent processing with 5 workers
  - Auto-cleanup of completed jobs
  - Keep last 10 failed jobs for debugging

### 2. Repository (`analytics.repository.ts`)
**Main Functions**:
- `getTodaysAnalytics()` - Get or create today's analytics record
- `calculateUserStorage()` - Calculate total storage and categorize by file type
- `recordFileUpload()` - Update analytics when file is uploaded
- `recordFileDelete()` - Update analytics when file is deleted
- `recordFolderCreate()` - Update analytics when folder is created
- `recordFileDownload()` - Track downloads
- `recordFileShare()` - Track shares
- `recordPublicLinkCreate()` - Track public links
- `getAnalyticsByDateRange()` - Get analytics for date range
- `getLatestAnalytics()` - Get most recent analytics
- `getAnalyticsSummary()` - Get 30-day summary

### 3. Service (`analytics.service.ts`)
**Main Functions**:
- `processAnalyticsEvent()` - Process analytics events from queue
- `getAnalyticsSummary()` - Get summary for user
- `getAnalyticsByDateRange()` - Get analytics by date range
- `getCurrentStorageOverview()` - Get current storage breakdown

### 4. Controller (`analytics.controller.ts`)
**Endpoints Implemented**:
- `GET /api/v1/analytics/summary` - Get 30-day analytics summary
- `GET /api/v1/analytics/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get analytics for specific date range
- `GET /api/v1/analytics/storage` - Get current storage overview

### 5. Routes (`analytics.routes.ts`)
All routes are protected with authentication middleware.

## Data Model

### StorageAnalytics Table
```typescript
{
  id: UUID
  user_id: UUID
  date: DATE (unique per user per day)
  
  // Storage metrics
  total_files: INTEGER
  total_folders: INTEGER
  total_size: BIGINT
  
  // File type breakdown
  images_count: INTEGER
  images_size: BIGINT
  videos_count: INTEGER
  videos_size: BIGINT
  audio_count: INTEGER
  audio_size: BIGINT
  documents_count: INTEGER
  documents_size: BIGINT
  other_count: INTEGER
  other_size: BIGINT
  
  // Daily activity
  uploads_today: INTEGER
  downloads_today: INTEGER
  shares_created_today: INTEGER
  public_links_created_today: INTEGER
  
  created_at: TIMESTAMP
}
```

## Integration Points

### File Controller
Analytics events are tracked when:
- Creating folders → `FOLDER_CREATED`
- Creating files → `FILE_UPLOADED`
- Deleting files → `FILE_DELETED`
- Sharing files → `FILE_SHARED`

### Upload Controller
Analytics events are tracked when:
- Uploading files (direct) → `FILE_UPLOADED`
- Uploading files (multipart) → Handled in File controller after completion

## API Usage Examples

### 1. Get Storage Overview
```http
GET /api/v1/analytics/storage
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Storage overview retrieved successfully",
  "data": {
    "storage": {
      "totalFiles": 456,
      "totalFolders": 23,
      "totalSize": 48622632960,
      "imageCount": 234,
      "imageSize": 20131512320,
      "videoCount": 67,
      "videoSize": 9556590592,
      "audioCount": 123,
      "audioSize": 3442319360,
      "documentCount": 32,
      "documentSize": 13346765824
    },
    "todayActivity": {
      "uploads": 12,
      "downloads": 34,
      "shares": 5,
      "publicLinks": 2
    },
    "storageQuota": 107374182400,
    "storageUsed": 48622632960,
    "storageRemaining": 58751549440,
    "storageUsedPercentage": "45.28"
  }
}
```

### 2. Get 30-Day Summary
```http
GET /api/v1/analytics/summary
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Analytics summary retrieved successfully",
  "data": {
    "current": { /* Today's analytics */ },
    "last30Days": [ /* Array of daily analytics */ ],
    "totalUploads": 145,
    "totalDownloads": 892,
    "totalShares": 34
  }
}
```

### 3. Get Date Range Analytics
```http
GET /api/v1/analytics/date-range?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Analytics retrieved successfully",
  "data": [ /* Array of analytics for each day */ ]
}
```

## File Type Categorization

Files are automatically categorized based on MIME type:
- **Images**: `image/*`
- **Videos**: `video/*`
- **Audio**: `audio/*`
- **Documents**: PDFs, Word docs, spreadsheets, presentations, text files
- **Other**: Everything else

## Performance Considerations

1. **Async Processing**: All analytics updates happen asynchronously via queue
2. **Daily Aggregation**: One record per user per day reduces database size
3. **Efficient Queries**: Indexed on `user_id` and `date`
4. **Caching Ready**: Current storage can be cached and invalidated on changes

## Monitoring

- Queue events are logged: completed, failed, errors
- Failed jobs are retried up to 5 times
- Last 10 failed jobs are kept for debugging

## Next Steps

Consider adding:
1. **Cron Job**: Daily cleanup of old analytics (keep last 90 days)
2. **Real-time Dashboard**: WebSocket updates for live analytics
3. **Export Feature**: CSV/Excel export of analytics data
4. **Alerts**: Notify users when approaching storage quota
5. **Charts API**: Pre-aggregated data for frontend charts

