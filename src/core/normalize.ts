/**
 * Normalization rules for Postman Collections
 * Implements all rules from section 3.3 of the specifications
 */

import type { 
  PostmanCollection, 
  PostmanItem, 
  PostmanRequest, 
  PostmanUrl, 
  PostmanHeader, 
  PostmanQueryParam, 
  PostmanEvent,
  PostmanRequestBody
} from '../types/postman';

// Type alias for form parameters
type PostmanFormParam = {
  key: string;
  value?: string;
  src?: string | string[];
  type?: string;
  disabled?: boolean;
};

// Type alias for PostmanBody
type PostmanBody = PostmanRequestBody;

export interface NormalizedCollection {
  info: {
    name: string;
    schema: string;
    description?: string;
  };
  item: NormalizedItem[];
  scripts?: {
    prerequest?: string;
    test?: string;
  };
}

export interface NormalizedItem {
  name: string;
  description?: string;
  type: 'folder' | 'request';
  item?: NormalizedItem[]; // for folders
  request?: NormalizedRequest;
  scripts?: {
    prerequest?: string;
    test?: string;
  };
}

export interface NormalizedRequest {
  method: string;
  url: NormalizedUrl;
  headers: NormalizedHeader[];
  query: NormalizedQueryParam[];
  body: NormalizedBody;
}

export interface NormalizedUrl {
  raw: string;
  protocol?: string;
  host: string;
  path: string;
  query: string;
}

export interface NormalizedHeader {
  key: string;
  value: string;
  description?: string;
}

export interface NormalizedQueryParam {
  key: string;
  value: string;
  description?: string;
}

export interface NormalizedBody {
  mode?: string;
  content: string | null;
  contentType?: string;
}

export interface NormalizationOptions {
  removeVolatileFields?: boolean;
  sortItems?: boolean;
  prettifyScripts?: boolean;
  prettifyJson?: boolean;
  normalizeWhitespace?: boolean;
}

const DEFAULT_OPTIONS: Required<NormalizationOptions> = {
  removeVolatileFields: true,
  sortItems: true,
  prettifyScripts: false, // Will be enabled when Prettier is available
  prettifyJson: true,
  normalizeWhitespace: true,
};

/**
 * Normalize a Postman collection according to the specification rules
 */
export function normalizeCollection(
  collection: PostmanCollection, 
  options: NormalizationOptions = {}
): NormalizedCollection {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Normalize info section - remove volatile fields
  const normalizedInfo: NormalizedCollection['info'] = {
    name: collection.info.name,
    schema: collection.info.schema,
  };

  // Note: PostmanCollection info doesn't have description in our types

  // Normalize collection-level events
  const collectionScripts = normalizeEvents(collection.event || [], opts);

  // Normalize items
  const normalizedItems = normalizeItems(collection.item, opts);

  const normalized: NormalizedCollection = {
    info: normalizedInfo,
    item: normalizedItems,
  };

  if (collectionScripts && (collectionScripts.prerequest || collectionScripts.test)) {
    normalized.scripts = collectionScripts;
  }

  return normalized;
}

/**
 * Normalize an array of items (folders and requests)
 */
function normalizeItems(items: PostmanItem[], options: Required<NormalizationOptions>): NormalizedItem[] {
  const normalized = items.map(item => normalizeItem(item, options));
  
  if (options.sortItems) {
    // Sort by name for canonical ordering
    normalized.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return normalized;
}

/**
 * Normalize a single item (folder or request)
 */
function normalizeItem(item: PostmanItem, options: Required<NormalizationOptions>): NormalizedItem {
  const normalized: NormalizedItem = {
    name: item.name,
    type: item.request ? 'request' : 'folder',
  };

  // Note: PostmanItem doesn't have description in our types

  // Normalize item-level events
  const itemScripts = normalizeEvents(item.event || [], options);
  if (itemScripts && (itemScripts.prerequest || itemScripts.test)) {
    normalized.scripts = itemScripts;
  }

  // If it's a folder, normalize its items
  if (item.item && Array.isArray(item.item)) {
    normalized.item = normalizeItems(item.item, options);
  }

  // If it's a request, normalize the request
  if (item.request) {
    normalized.request = normalizeRequest(item.request, options);
  }

  return normalized;
}

/**
 * Normalize a request object
 */
function normalizeRequest(request: PostmanRequest, options: Required<NormalizationOptions>): NormalizedRequest {
  return {
    method: request.method.toUpperCase(),
    url: normalizeUrl(request.url),
    headers: normalizeHeaders(request.header || [], options),
    query: [], // Query params are handled in URL normalization
    body: normalizeBody(request.body, options),
  };
}

/**
 * Normalize URL (handle both string and object formats)
 */
function normalizeUrl(url: string | PostmanUrl | undefined): NormalizedUrl {
  if (!url) {
    return {
      raw: '',
      host: '',
      path: '',
      query: '',
    };
  }

  if (typeof url === 'string') {
    return parseStringUrl(url);
  }

  // Handle URL object
  const urlObj = url as PostmanUrl;
  
  // Build canonical URL
  const protocol = urlObj.protocol || '';
  const host = Array.isArray(urlObj.host) ? urlObj.host.join('.') : (urlObj.host || '');
  const path = Array.isArray(urlObj.path) ? '/' + urlObj.path.join('/') : (urlObj.path || '');
  
  // Normalize and sort query parameters
  const query = normalizeQueryParams(urlObj.query || []);
  const queryString = query.map(q => `${q.key}=${encodeURIComponent(q.value)}`).join('&');
  
  const raw = urlObj.raw || `${protocol}://${host}${path}${queryString ? '?' + queryString : ''}`;

  return {
    raw,
    protocol,
    host,
    path,
    query: queryString,
  };
}

/**
 * Parse a string URL into normalized components
 */
function parseStringUrl(urlString: string): NormalizedUrl {
  try {
    // Handle variable placeholders like {{URL}}
    if (urlString.includes('{{') && urlString.includes('}}')) {
      return {
        raw: urlString,
        host: extractHostFromTemplate(urlString),
        path: extractPathFromTemplate(urlString),
        query: '',
      };
    }

    const url = new URL(urlString);
    
    // Sort query parameters
    const queryParams: Array<[string, string]> = [];
    url.searchParams.forEach((value, key) => {
      queryParams.push([key, value]);
    });
    queryParams.sort(([a], [b]) => a.localeCompare(b));
    
    const queryString = queryParams
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    return {
      raw: urlString,
      protocol: url.protocol.replace(':', ''),
      host: url.hostname + (url.port ? ':' + url.port : ''),
      path: url.pathname,
      query: queryString,
    };
  } catch {
    // If URL parsing fails, treat as template or invalid URL
    return {
      raw: urlString,
      host: extractHostFromTemplate(urlString),
      path: extractPathFromTemplate(urlString),
      query: '',
    };
  }
}

/**
 * Extract host from template URL
 */
function extractHostFromTemplate(url: string): string {
  const match = url.match(/(?:https?:\/\/)?([^\/\?]+)/);
  return match ? match[1] : '';
}

/**
 * Extract path from template URL
 */
function extractPathFromTemplate(url: string): string {
  const match = url.match(/(?:https?:\/\/[^\/]+)(\/[^\?]*)/);
  return match ? match[1] : '';
}

/**
 * Normalize headers - trim, sort, dedupe
 */
function normalizeHeaders(headers: PostmanHeader[], _options: Required<NormalizationOptions>): NormalizedHeader[] {
  const headerMap: { [key: string]: NormalizedHeader } = {};

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header.disabled) continue;
    
    const key = header.key.trim();
    const value = header.value.trim();
    
    if (!key || !value) continue;

    // Use lowercase key for deduplication, but preserve original case
    const lowerKey = key.toLowerCase();
    headerMap[lowerKey] = {
      key,
      value,
      description: header.description ? normalizeDescription(header.description) : undefined,
    };
  }

  // Convert to array and sort by key (case-insensitive)
  const normalized: NormalizedHeader[] = [];
  for (const key in headerMap) {
    if (headerMap.hasOwnProperty(key)) {
      normalized.push(headerMap[key]);
    }
  }
  
  normalized.sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()));
  return normalized;
}

/**
 * Normalize query parameters - trim, sort, dedupe
 */
function normalizeQueryParams(params: PostmanQueryParam[]): NormalizedQueryParam[] {
  const paramMap = new Map<string, NormalizedQueryParam>();

  for (const param of params) {
    if (param.disabled) continue;
    
    const key = param.key.trim();
    const value = param.value.trim();
    
    if (!key) continue;

    paramMap.set(key, {
      key,
      value,
      description: param.description ? normalizeDescription(param.description) : undefined,
    });
  }

  // Convert to array and sort by key
  const normalized = Array.from(paramMap.values())
    .sort((a, b) => a.key.localeCompare(b.key));

  return normalized;
}

/**
 * Normalize request body
 */
function normalizeBody(body: PostmanBody | undefined, options: Required<NormalizationOptions>): NormalizedBody {
  if (!body || !body.mode) {
    return { content: null };
  }

  switch (body.mode) {
    case 'raw':
      return normalizeRawBody(body, options);
    case 'formdata':
      return normalizeFormDataBody(body);
    case 'urlencoded':
      return normalizeUrlencodedBody(body);
    case 'file':
      return normalizeFileBody(body);
    case 'graphql':
      return normalizeGraphQLBody(body, options);
    default:
      return { 
        mode: body.mode,
        content: body.raw || null 
      };
  }
}

/**
 * Normalize raw body (handles JSON pretty-printing)
 */
function normalizeRawBody(body: PostmanBody, options: Required<NormalizationOptions>): NormalizedBody {
  let content = body.raw || '';
  const contentType = body.options?.raw?.language || '';

  // Pretty-print JSON if enabled and content looks like JSON
  if (options.prettifyJson && (contentType === 'json' || isJsonContent(content))) {
    try {
      const parsed = JSON.parse(content);
      content = JSON.stringify(parsed, null, 2);
    } catch {
      // Not valid JSON, keep as-is
    }
  }

  if (options.normalizeWhitespace && contentType !== 'json') {
    content = content.trim();
  }

  return {
    mode: 'raw',
    content,
    contentType,
  };
}

/**
 * Normalize form-data body
 */
function normalizeFormDataBody(body: PostmanBody): NormalizedBody {
  if (!body.formdata) {
    return { mode: 'formdata', content: null };
  }

  const normalized = normalizeFormParams(body.formdata);
  const content = normalized
    .map(param => `${param.key}=${param.value || ''}`)
    .join('&');

  return {
    mode: 'formdata',
    content,
  };
}

/**
 * Normalize URL-encoded body
 */
function normalizeUrlencodedBody(body: PostmanBody): NormalizedBody {
  if (!body.urlencoded) {
    return { mode: 'urlencoded', content: null };
  }

  const normalized = normalizeFormParams(body.urlencoded);
  const content = normalized
    .map(param => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value || '')}`)
    .join('&');

  return {
    mode: 'urlencoded',
    content,
  };
}

/**
 * Normalize file body
 */
function normalizeFileBody(body: PostmanBody): NormalizedBody {
  const src = body.file?.src || '';
  return {
    mode: 'file',
    content: `[FILE: ${src}]`,
  };
}

/**
 * Normalize GraphQL body
 */
function normalizeGraphQLBody(body: PostmanBody, options: Required<NormalizationOptions>): NormalizedBody {
  if (!body.graphql) {
    return { mode: 'graphql', content: null };
  }

  const query = body.graphql.query || '';
  let variables = body.graphql.variables || '';

  // Pretty-print variables if they're JSON
  if (options.prettifyJson && variables) {
    try {
      const parsed = JSON.parse(variables);
      variables = JSON.stringify(parsed, null, 2);
    } catch {
      // Not valid JSON, keep as-is
    }
  }

  const content = JSON.stringify({
    query: query.trim(),
    variables: variables.trim() || undefined,
  }, null, 2);

  return {
    mode: 'graphql',
    content,
  };
}

/**
 * Normalize form parameters (formdata/urlencoded)
 */
function normalizeFormParams(params: PostmanFormParam[]): Array<{ key: string; value: string; type?: string }> {
  const paramMap = new Map<string, { key: string; value: string; type?: string }>();

  for (const param of params) {
    if (param.disabled) continue;
    
    const key = param.key.trim();
    if (!key) continue;

    let value = '';
    if (param.type === 'file' && param.src) {
      value = Array.isArray(param.src) ? param.src.join(', ') : param.src;
    } else {
      value = param.value || '';
    }

    paramMap.set(key, {
      key,
      value,
      type: param.type,
    });
  }

  // Convert to array and sort by key
  return Array.from(paramMap.values())
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Normalize events (convert to scripts object)
 */
function normalizeEvents(events: PostmanEvent[], options: Required<NormalizationOptions>): { prerequest?: string; test?: string } | null {
  if (!events.length) return null;

  const scripts: { prerequest?: string; test?: string } = {};
  const eventGroups = new Map<string, string[]>();

  // Group events by listen type
  for (const event of events) {
    if (!event.script?.exec) continue;

    const listen = event.listen;
    const exec = Array.isArray(event.script.exec) ? event.script.exec : [event.script.exec];
    
    if (!eventGroups.has(listen)) {
      eventGroups.set(listen, []);
    }
    
    eventGroups.get(listen)!.push(...exec);
  }

  // Join and normalize scripts
  for (const [listen, execLines] of eventGroups) {
    if (listen === 'prerequest' || listen === 'test') {
      let script = execLines.join('\n');
      
      if (options.normalizeWhitespace) {
        script = normalizeScriptWhitespace(script);
      }

      if (options.prettifyScripts) {
        script = prettifyScript(script);
      }

      if (script.trim()) {
        scripts[listen] = script;
      }
    }
  }

  return Object.keys(scripts).length > 0 ? scripts : null;
}

/**
 * Normalize script whitespace
 */
function normalizeScriptWhitespace(script: string): string {
  return script
    .split('\n')
    .map(line => line.trimEnd()) // Remove trailing whitespace
    .join('\n')
    .trim(); // Remove leading/trailing empty lines
}

/**
 * Prettify script using Prettier (placeholder for when Prettier is available)
 */
function prettifyScript(script: string): string {
  // TODO: Implement Prettier formatting when available
  // For now, just normalize whitespace
  return normalizeScriptWhitespace(script);
}

/**
 * Normalize description text
 */
function normalizeDescription(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, ' '); // Collapse whitespace
}

/**
 * Check if content looks like JSON
 */
function isJsonContent(content: string): boolean {
  const trimmed = content.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}