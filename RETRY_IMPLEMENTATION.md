# Retry Implementation for 503 Errors

## Overview
This document describes the implementation of exponential backoff retry logic for handling 503 Service Unavailable errors in the Gemini API service.

## Requirements Implemented

### ✅ 1. Automatic Retry on 503 Errors
- The `makeAPIRequest` function now automatically retries requests that receive a 503 Service Unavailable response
- Retry logic is only triggered for 503 errors; other error codes fail immediately

### ✅ 2. Exponential Backoff Algorithm
The retry mechanism uses exponential backoff with the following intervals:
- **1st retry**: 1 second wait
- **2nd retry**: 2 seconds wait  
- **3rd retry**: 4 seconds wait

**Formula**: `waitSeconds = retryDelay * Math.pow(2, retryCount) / 1000`
- `retryDelay` = 1000 ms (base delay)
- `retryCount` = 0, 1, 2 (for retries 1, 2, 3)

### ✅ 3. Maximum Retry Count
- Maximum retry count is set to **3 attempts**
- After 3 failed retries, the error is thrown to the caller
- Total possible requests: 1 initial + 3 retries = 4 attempts

### ✅ 4. Immediate Failure for Non-503 Errors
The following error codes fail immediately without retry:
- **401/403**: Authentication/Authorization errors
- **404**: Not Found errors
- **429**: Rate Limiting errors
- **4xx**: Other client errors
- **Network errors**: Connection failures

## Code Changes

### File: `gemini-service.js`

#### Change 1: Updated Configuration (Line 13-14)
```javascript
this.retryDelay = 1000; // 初期リトライ間隔（指数バックオフの基準）
this.maxRetries = 3; // 503エラー用の最大リトライ回数
```

#### Change 2: Simplified 503 Error Handling (Lines 378-412)
```javascript
// 503エラーの場合、指数バックオフでリトライ
if (response.status === 503) {
    const errorData = await response.json().catch(() => null);
    console.error(`🔍 503エラーの詳細:`, { /* ... */ });
    
    // 最大リトライ回数をチェック
    if (retryCount < this.maxRetries) {
        // 指数バックオフ: 1秒 -> 2秒 -> 4秒
        const waitSeconds = this.retryDelay * Math.pow(2, retryCount) / 1000;
        const waitMs = waitSeconds * 1000;
        
        console.log(`⏳ 503エラー: ${retryCount + 1}回目のリトライを${waitSeconds}秒後に実行します...`);
        await this.delay(waitMs);
        return await this.makeAPIRequest(url, requestBody, retryCount + 1);
    }
    
    // 最大リトライ回数に達した場合、エラーをスロー
    // ... error handling ...
}
```

## Benefits

1. **Improved Reliability**: Temporary server overload situations are handled gracefully
2. **User Experience**: Fewer failed requests due to transient errors
3. **Clean Implementation**: Simplified retry logic that's easy to understand and maintain
4. **Proper Backoff**: Exponential delays prevent overwhelming the server with rapid retries
5. **Fast Failure**: Non-retryable errors fail quickly, improving responsiveness

## Testing

### Exponential Backoff Calculation Test
```javascript
const retryDelay = 1000;
const maxRetries = 3;

for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    const waitSeconds = retryDelay * Math.pow(2, retryCount) / 1000;
    console.log(`Retry ${retryCount + 1}: Wait ${waitSeconds} seconds`);
}

// Output:
// Retry 1: Wait 1 seconds
// Retry 2: Wait 2 seconds
// Retry 3: Wait 4 seconds
```

### Expected Behavior

#### Scenario 1: 503 Error with Successful Retry
```
1. Initial request → 503 error
2. Wait 1 second
3. Retry 1 → 503 error
4. Wait 2 seconds
5. Retry 2 → 200 OK ✅
```

#### Scenario 2: 503 Error with All Retries Failed
```
1. Initial request → 503 error
2. Wait 1 second
3. Retry 1 → 503 error
4. Wait 2 seconds
5. Retry 2 → 503 error
6. Wait 4 seconds
7. Retry 3 → 503 error
8. Throw error ❌
```

#### Scenario 3: 401 Error (No Retry)
```
1. Initial request → 401 error
2. Throw error immediately ❌ (no retry)
```

## Dependencies

**None** - This implementation uses native JavaScript features:
- `Math.pow()` for exponential calculation
- `Promise` and `async/await` for asynchronous flow
- Native `setTimeout` (via `delay` method) for waiting

## Notes

- The implementation is browser-based and requires no npm packages
- Logging is comprehensive to help with debugging
- Error messages are user-friendly and in Japanese
- The retry mechanism respects the existing error handling for other status codes
