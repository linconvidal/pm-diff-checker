/**
 * Stable hashing functions for Postman collections
 */

/**
 * Simple hash function for creating stable hashes
 * Based on the djb2 algorithm - simple but effective for our use case
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Create a structure hash based on names and paths
 * This is used for move/rename detection
 */
export function createStructureHash(path: string[], type: string, name: string): string {
  const pathStr = path.join('/');
  const input = `${type}:${pathStr}:${name}`;
  return simpleHash(input);
}

/**
 * Create a content hash for request data
 * This includes method, URL, headers, body, and scripts
 */
export function createContentHash(requestData: {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  query: Array<{ key: string; value: string }>;
  body: string | null;
  scripts: {
    prerequest?: string;
    test?: string;
  };
}): string {
  // Normalize the content for hashing
  const normalizedContent = {
    method: requestData.method.toUpperCase(),
    url: requestData.url,
    headers: requestData.headers
      .map(h => `${h.key.toLowerCase()}:${h.value}`)
      .sort()
      .join('|'),
    query: requestData.query
      .map(q => `${q.key}=${q.value}`)
      .sort()
      .join('&'),
    body: requestData.body || '',
    prerequest: requestData.scripts.prerequest || '',
    test: requestData.scripts.test || ''
  };

  const input = JSON.stringify(normalizedContent);
  return simpleHash(input);
}

/**
 * Create a collection-level hash for quick comparison
 */
export function createCollectionHash(normalizedCollection: any): string {
  // Remove any remaining volatile fields and create a stable representation
  const stableCollection = JSON.stringify(normalizedCollection, null, 0);
  return simpleHash(stableCollection);
}

/**
 * Create a hash for a folder/item structure (excluding content)
 */
export function createFolderStructureHash(items: Array<{ name: string; type: string }>): string {
  const structure = items
    .map(item => `${item.type}:${item.name}`)
    .sort()
    .join('|');
  return simpleHash(structure);
}

/**
 * Create a hash for just the names and hierarchy (used for detecting renames)
 */
export function createNameHash(name: string): string {
  return simpleHash(name.toLowerCase().trim());
}

/**
 * Create a hash for URL components (normalized)
 */
export function createUrlHash(url: {
  protocol?: string;
  host: string;
  path: string;
  query: string;
}): string {
  const normalizedUrl = `${url.protocol || 'https'}://${url.host}${url.path}${url.query ? '?' + url.query : ''}`;
  return simpleHash(normalizedUrl);
}

/**
 * Create a hash for headers (normalized and sorted)
 */
export function createHeadersHash(headers: Array<{ key: string; value: string }>): string {
  const normalizedHeaders = headers
    .map(h => `${h.key.toLowerCase().trim()}:${h.value.trim()}`)
    .filter(h => h.length > 1) // Remove empty headers
    .sort()
    .join('|');
  return simpleHash(normalizedHeaders);
}

/**
 * Create a hash for body content
 */
export function createBodyHash(body: string | null): string {
  if (!body) return simpleHash('');
  
  // Try to parse as JSON and normalize if possible
  try {
    const parsed = JSON.parse(body);
    const normalized = JSON.stringify(parsed);
    return simpleHash(normalized);
  } catch {
    // Not JSON, hash as-is but normalize whitespace
    const normalized = body.trim().replace(/\s+/g, ' ');
    return simpleHash(normalized);
  }
}

/**
 * Create a hash for script content (normalized)
 */
export function createScriptHash(script: string): string {
  // Normalize whitespace and remove comments for better comparison
  const normalized = script
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return simpleHash(normalized);
}

/**
 * Generic hash function for content
 * Alias for simpleHash to maintain compatibility
 */
export function generateHashSync(content: string): string {
  return simpleHash(content);
}