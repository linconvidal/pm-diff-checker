/**
 * Type definitions for Postman Collection Diff Viewer
 * Based on Postman Collection v2.1 format and normalized AST model
 */

// =============================================================================
// POSTMAN COLLECTION V2.1 INPUT TYPES
// =============================================================================

export interface PostmanCollection {
  info: CollectionInfo;
  item: PostmanItem[];
  auth?: PostmanAuth;
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
}

export interface CollectionInfo {
  _postman_id?: string;
  name: string;
  description?: string | PostmanDescription;
  version?: string;
  schema: string;
  _exporter_id?: string;
  _collection_link?: string;
  createdAt?: string;
  updatedAt?: string;
  uid?: string;
  owner?: string;
  fork?: any;
}

export interface PostmanDescription {
  content?: string;
  type?: string;
  version?: string;
}

export interface PostmanItem {
  id?: string;
  name: string;
  description?: string | PostmanDescription;
  item?: PostmanItem[];
  request?: PostmanRequest;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
}

export interface PostmanRequest {
  url: string | PostmanUrl;
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
  description?: string | PostmanDescription;
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  port?: string;
  path?: string | string[];
  query?: PostmanQueryParam[];
  hash?: string;
  variable?: PostmanVariable[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  description?: string | PostmanDescription;
  disabled?: boolean;
  type?: string;
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string | PostmanDescription;
  disabled?: boolean;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';
  raw?: string;
  urlencoded?: PostmanFormParam[];
  formdata?: PostmanFormParam[];
  file?: {
    src: string;
  };
  graphql?: {
    query?: string;
    variables?: string;
  };
  options?: {
    raw?: {
      language?: string;
    };
  };
  disabled?: boolean;
}

export interface PostmanFormParam {
  key: string;
  value?: string;
  src?: string;
  type?: 'text' | 'file';
  description?: string | PostmanDescription;
  disabled?: boolean;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: PostmanScript;
  disabled?: boolean;
}

export interface PostmanScript {
  id?: string;
  type: string;
  exec: string[];
  packages?: Record<string, any>;
}

export interface PostmanAuth {
  type: string;
  [key: string]: any;
}

export interface PostmanVariable {
  key: string;
  value: any;
  type?: string;
  description?: string | PostmanDescription;
  disabled?: boolean;
}

export interface PostmanResponse {
  id?: string;
  name?: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
  cookie?: any[];
  responseTime?: number;
}

// =============================================================================
// NORMALIZED AST MODEL
// =============================================================================

export type NodeType = "collection" | "folder" | "request";

export interface AstNode {
  id: string;              // synthetic stable id
  type: NodeType;
  name: string;
  path: string[];          // collection/name/.../request
  children: AstNode[];
  data?: RequestData;      // only for requests
  hashes: {
    structure: string;     // hash of names/paths for move/rename detection
    content?: string;      // hash of normalized request content (method/url/headers/body/scripts)
  };
}

export interface RequestData {
  method: string;
  url: CanonUrl;           // normalized
  headers: Header[];
  query: QueryParam[];
  body: NormalizedBody;    // raw pretty or form-data sorted
  scripts: {
    prerequest?: string;   // joined + formatted JS
    test?: string;         // joined + formatted JS
  };
  auth?: PostmanAuth;
  description?: string;
}

export interface CanonUrl {
  raw: string;             // original raw URL
  canonical: string;       // normalized canonical URL
  protocol?: string;
  host?: string;
  port?: string;
  path?: string;
  query?: QueryParam[];
  hash?: string;
}

export interface Header {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface QueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface NormalizedBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | 'none';
  raw?: string;            // pretty-printed if JSON, otherwise original
  urlencoded?: FormParam[];
  formdata?: FormParam[];
  file?: {
    src: string;
  };
  graphql?: {
    query?: string;
    variables?: string;
  };
  contentType?: string;
}

export interface FormParam {
  key: string;
  value?: string;
  src?: string;
  type?: 'text' | 'file';
  description?: string;
  disabled?: boolean;
}

// =============================================================================
// DIFF-RELATED TYPES
// =============================================================================

export type DiffStatus = "added" | "removed" | "moved" | "renamed" | "modified" | "unchanged";

export interface DiffResult {
  oldAst: AstNode;
  newAst: AstNode;
  treeDiff: TreeDiff[];
  summary: DiffSummary;
}

export interface TreeDiff {
  nodeId: string;
  oldNode?: AstNode;
  newNode?: AstNode;
  status: DiffStatus;
  oldPath?: string[];
  newPath?: string[];
  requestDiff?: RequestDiff;
  children?: TreeDiff[];
}

export interface RequestDiff {
  method?: FieldDiff;
  url?: FieldDiff;
  headers?: FieldDiff;
  query?: FieldDiff;
  body?: FieldDiff;
  auth?: FieldDiff;
  description?: FieldDiff;
  scripts?: {
    prerequest?: FieldDiff;
    test?: FieldDiff;
  };
}

export interface FieldDiff {
  changed: boolean;
  oldValue?: any;
  newValue?: any;
  patch?: string;         // unified diff patch
  html?: string;          // diff2html rendered HTML
}

export interface DiffSummary {
  counts: {
    added: number;
    removed: number;
    moved: number;
    renamed: number;
    modified: number;
    unchanged: number;
    total: number;
  };
  changes: ChangeDescription[];
}

export interface ChangeDescription {
  type: DiffStatus;
  nodeType: NodeType;
  path: string[];
  oldPath?: string[];
  newPath?: string[];
  name: string;
  oldName?: string;
  newName?: string;
  details?: string[];     // specific field changes for modified requests
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface AppState {
  files: {
    old?: File;
    new?: File;
  };
  collections: {
    old?: PostmanCollection;
    new?: PostmanCollection;
  };
  ast: {
    old?: AstNode;
    new?: AstNode;
  };
  diff?: DiffResult;
  ui: UiState;
  config: AppConfig;
}

export interface UiState {
  selectedNodeId?: string;
  selectedTab: DiffTab;
  treeFilter: DiffStatus[];
  loading: boolean;
  error?: string;
  expandedNodes: Set<string>;
}

export type DiffTab = 'overview' | 'request' | 'prerequest' | 'test' | 'body' | 'global';

export interface AppConfig {
  ignoreIds: boolean;
  sortItems: boolean;
  prettierScripts: boolean;
  prettyJsonBodies: boolean;
  hideWhitespaceChanges: boolean;
  showLineNumbers: boolean;
}

// =============================================================================
// GITHUB INTEGRATION TYPES
// =============================================================================

export interface GitHubFileRef {
  owner: string;
  repo: string;
  path: string;
  ref?: string;           // commit hash, branch, or tag
}

export interface GitHubApiResponse {
  content: string;        // base64 encoded
  encoding: string;
  sha: string;
  size: number;
  url: string;
}

// =============================================================================
// NORMALIZATION OPTIONS
// =============================================================================

export interface NormalizationOptions {
  removeIds: boolean;
  sortItems: boolean;
  formatScripts: boolean;
  prettyJsonBodies: boolean;
  canonicalizeUrls: boolean;
  trimWhitespace: boolean;
  deduplicateHeaders: boolean;
  sortFormData: boolean;
}

// =============================================================================
// HASH COMPUTATION TYPES
// =============================================================================

export interface HashOptions {
  algorithm: 'murmur3' | 'xxhash' | 'sha256';
  seed?: number;
}

export interface ContentHashes {
  structure: string;      // name + path + type
  content?: string;       // normalized request content
  method?: string;        // just the method
  url?: string;          // just the canonical URL
  headers?: string;       // sorted headers
  body?: string;         // normalized body
  scripts?: string;       // combined scripts
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface ValidationError {
  code: string;
  message: string;
  path?: string[];
  details?: any;
}

export interface ParseError extends ValidationError {
  line?: number;
  column?: number;
}

export interface DiffError extends Error {
  code: string;
  context?: any;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export interface ExportOptions {
  format: 'markdown' | 'json' | 'html';
  includeUnchanged: boolean;
  includePaths: boolean;
  includeDetails: boolean;
}

export interface MarkdownExport {
  summary: string;
  content: string;
  metadata: {
    oldFile?: string;
    newFile?: string;
    timestamp: string;
    totalChanges: number;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isPostmanCollection(obj: any): obj is PostmanCollection {
  return obj && 
         typeof obj === 'object' &&
         obj.info &&
         typeof obj.info.name === 'string' &&
         typeof obj.info.schema === 'string' &&
         Array.isArray(obj.item);
}

export function isPostmanItem(obj: any): obj is PostmanItem {
  return obj &&
         typeof obj === 'object' &&
         typeof obj.name === 'string' &&
         (obj.item || obj.request);
}

export function isPostmanRequest(obj: any): obj is PostmanRequest {
  return obj &&
         typeof obj === 'object' &&
         typeof obj.method === 'string' &&
         obj.url;
}

export function isAstNode(obj: any): obj is AstNode {
  return obj &&
         typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.type === 'string' &&
         ['collection', 'folder', 'request'].includes(obj.type) &&
         typeof obj.name === 'string' &&
         Array.isArray(obj.path) &&
         Array.isArray(obj.children) &&
         obj.hashes &&
         typeof obj.hashes.structure === 'string';
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SUPPORTED_SCHEMA_VERSIONS = [
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  'https://schema.getpostman.com/json/collection/v2.0.0/collection.json'
] as const;

export const DEFAULT_CONFIG: AppConfig = {
  ignoreIds: true,
  sortItems: true,
  prettierScripts: true,
  prettyJsonBodies: true,
  hideWhitespaceChanges: true,
  showLineNumbers: true,
};

export const DEFAULT_NORMALIZATION_OPTIONS: NormalizationOptions = {
  removeIds: true,
  sortItems: true,
  formatScripts: true,
  prettyJsonBodies: true,
  canonicalizeUrls: true,
  trimWhitespace: true,
  deduplicateHeaders: true,
  sortFormData: true,
};

export const DIFF_COLORS = {
  added: '#28a745',
  removed: '#dc3545',
  moved: '#007bff',
  renamed: '#ffc107',
  modified: '#fd7e14',
  unchanged: '#6c757d',
} as const;