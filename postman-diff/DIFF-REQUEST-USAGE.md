# Request Diff Algorithm Usage

This document explains how to use the request diff algorithm implemented in `src/core/diff-request.ts`.

## Overview

The request diff algorithm compares two normalized Postman requests and generates detailed change information including:

- Field-level changes (method, URL, headers, query parameters, body, scripts)
- Unified diff patches for each changed field
- HTML diffs compatible with diff2html rendering
- Structured change analysis for headers and query parameters

## Basic Usage

```typescript
import { diffRequests, compareScripts } from './src/core/diff-request'
import type { NormalizedRequest } from './src/core/normalize'

// Compare two normalized requests
const result = diffRequests(oldRequest, newRequest, 'My Request')

// Check if there are any changes
if (result.hasChanges) {
  console.log('Request has changes!')
  
  // Iterate through field changes
  result.fieldChanges.forEach(change => {
    console.log(`${change.field}: ${change.changeType}`)
    if (change.reason) {
      console.log(`  Reason: ${change.reason}`)
    }
  })
  
  // Access patches for diff2html rendering
  if (result.patches.method?.hasChanges) {
    console.log('Method patch:', result.patches.method.htmlDiff)
  }
}
```

## API Reference

### `diffRequests(oldRequest, newRequest, requestName?)`

Compares two normalized requests and returns detailed diff information.

**Parameters:**
- `oldRequest: NormalizedRequest | undefined` - The original request
- `newRequest: NormalizedRequest | undefined` - The updated request  
- `requestName: string` - Optional name for the request (used in patch headers)

**Returns:** `RequestDiffResult`

### `compareScripts(oldScript, newScript, scriptType)`

Compares two script strings (prerequest or test scripts).

**Parameters:**
- `oldScript: string | undefined` - The original script
- `newScript: string | undefined` - The updated script
- `scriptType: 'prerequest' | 'test'` - The type of script

**Returns:** `FieldChangeResult`

## Result Types

### `RequestDiffResult`

```typescript
interface RequestDiffResult {
  hasChanges: boolean
  fieldChanges: FieldChangeResult[]
  patches: RequestPatchResult
}
```

### `FieldChangeResult`

```typescript
interface FieldChangeResult {
  field: RequestField
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  reason?: string
  patch?: string
  htmlDiff?: string
}
```

### `RequestPatchResult`

```typescript
interface RequestPatchResult {
  method?: PatchData
  url?: PatchData
  headers?: PatchData
  query?: PatchData
  body?: PatchData
  prerequestScript?: PatchData
  testScript?: PatchData
}
```

## Features

### Deep Equality Comparison
- Compares normalized `RequestData` structures via deep equality
- Handles both object and string URL formats
- Normalizes headers and query parameters for consistent comparison

### Field-Level Change Detection
- **Method changes**: Detects HTTP method modifications
- **URL changes**: Compares both string and object URL formats
- **Header changes**: Structured analysis with add/remove/modify detection
- **Query parameter changes**: Detailed parameter-level change tracking
- **Body changes**: Special handling for JSON with pretty-printing
- **Script changes**: Line-based diff for prerequest and test scripts

### Diff Generation
- Uses `jsdiff` library for generating unified patches
- Integrates with `diff2html` for HTML rendering
- Supports both line-based and JSON-based diffs
- Handles special cases for added/removed requests

### JSON Body Support
- Automatically detects JSON content
- Pretty-prints JSON for better diff visualization
- Falls back to text diff if JSON parsing fails
- Preserves content-type information

## Integration with diff2html

The generated patches are compatible with diff2html for rendering:

```typescript
import { html } from 'diff2html'

const result = diffRequests(oldRequest, newRequest)
if (result.patches.body?.hasChanges) {
  const htmlDiff = result.patches.body.htmlDiff
  // htmlDiff is ready to be inserted into the DOM
  document.getElementById('diff-container').innerHTML = htmlDiff
}
```

## Examples

### Method Change
```typescript
// Old: GET request
// New: POST request
// Result: change.reason = "Method changed from GET to POST"
```

### Header Changes
```typescript
// Old: Authorization: Bearer token123
// New: Authorization: Bearer token456, Accept: application/json
// Result: change.reason = "Modified header: Authorization (Bearer token123 → Bearer token456); Added header: Accept = application/json"
```

### Body Changes
```typescript
// Old: {"name": "test"}
// New: {"name": "test", "email": "test@example.com"}  
// Result: Pretty JSON diff showing added email field
```

## Notes

- All string comparisons are case-sensitive
- Headers are compared case-insensitively for keys but preserve original casing
- Query parameters are sorted by key for consistent comparison
- Empty or null bodies are treated as equivalent
- Scripts are compared line-by-line for better change visibility