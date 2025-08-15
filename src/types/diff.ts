import type { Change } from 'diff'

// Diff-related types
export interface DiffResult {
  oldCollection: string
  newCollection: string
  patches: Change[]
  htmlDiff: string
}

export interface NormalizedCollection {
  info: {
    name: string
    version?: string
  }
  items: NormalizedItem[]
}

export interface NormalizedItem {
  id: string
  name: string
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: string
  tests?: string[]
  children?: NormalizedItem[]
}

export interface DiffOptions {
  ignoreOrder?: boolean
  ignoreWhitespace?: boolean
  normalizeJson?: boolean
  sortKeys?: boolean
}

// Request-specific diff types
export interface RequestDiffResult {
  hasChanges: boolean
  fieldChanges: FieldChangeResult[]
  patches: RequestPatchResult
}

export interface FieldChangeResult {
  field: RequestField
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  reason?: string
  patch?: string
  htmlDiff?: string
}

export interface RequestPatchResult {
  method?: PatchData
  url?: PatchData
  headers?: PatchData
  query?: PatchData
  body?: PatchData
  prerequestScript?: PatchData
  testScript?: PatchData
}

export interface PatchData {
  patch: string
  htmlDiff: string
  hasChanges: boolean
}

export type RequestField = 'method' | 'url' | 'headers' | 'query' | 'body' | 'prerequestScript' | 'testScript'
