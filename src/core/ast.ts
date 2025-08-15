/**
 * AST Builder for Postman Collections
 * 
 * Converts normalized Postman collections into a tree structure
 * with stable IDs, path tracking, and hash computation.
 */

import { generateHashSync } from './hash.js';
import type { 
  PostmanCollection, 
  PostmanItem, 
  PostmanUrl, 
  PostmanHeader, 
  PostmanQueryParam, 
  PostmanRequestBody,
  PostmanEvent
} from '../types/postman';

// Type definitions based on section 3.2 of the specifications
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
}

export interface CanonUrl {
  raw?: string;
  protocol?: string;
  host: string[];
  path: string[];
  query: QueryParam[];
}

export interface Header {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface QueryParam {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface NormalizedBody {
  mode: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql';
  raw?: string;
  formdata?: FormDataParam[];
  urlencoded?: QueryParam[];
  file?: {
    src?: string;
  };
  graphql?: {
    query: string;
    variables?: string;
  };
}

export interface FormDataParam {
  key: string;
  value?: string;
  src?: string;
  type: 'text' | 'file';
  disabled?: boolean;
}

/**
 * AST result containing both tree and flat map for efficient lookups
 */
export interface AstResult {
  tree: AstNode;
  nodeMap: { [key: string]: AstNode };
}

/**
 * Generates a stable hash for content using browser-compatible hash function
 */
function generateHash(content: string): string {
  return generateHashSync(content);
}

/**
 * Generates a stable ID following the rule: type + "/" + path.join("/") + (for requests: "#" + method+url)
 */
function generateStableId(type: NodeType, path: string[], method?: string, url?: string): string {
  let id = type + "/" + path.join("/");
  
  if (type === "request" && method && url) {
    // Normalize URL for ID generation
    const normalizedUrl = typeof url === 'string' ? url : JSON.stringify(url);
    id += "#" + method.toLowerCase() + normalizedUrl;
  }
  
  return id;
}

/**
 * Normalizes a Postman URL into CanonUrl format
 */
function normalizeUrl(url: string | PostmanUrl): CanonUrl {
  if (typeof url === 'string') {
    return {
      raw: url,
      host: [],
      path: [],
      query: []
    };
  }

  const host = Array.isArray(url.host) ? url.host : (url.host ? [url.host] : []);
  const path = Array.isArray(url.path) ? url.path : (url.path ? [url.path] : []);
  const query = url.query || [];

  return {
    raw: url.raw,
    protocol: url.protocol,
    host,
    path,
    query: query.map(q => ({ key: q.key, value: q.value, disabled: q.disabled }))
  };
}

/**
 * Normalizes headers by trimming and sorting
 */
function normalizeHeaders(headers: PostmanHeader[] = []): Header[] {
  return headers
    .filter(h => h.key && h.key.trim()) // Remove empty headers
    .map(h => ({
      key: h.key.trim(),
      value: h.value ? h.value.trim() : '',
      disabled: h.disabled
    }))
    .sort((a, b) => a.key.localeCompare(b.key)); // Sort by key for canonical representation
}

/**
 * Normalizes query parameters by trimming and sorting
 */
function normalizeQueryParams(query: PostmanQueryParam[] = []): QueryParam[] {
  return query
    .filter(q => q.key && q.key.trim()) // Remove empty params
    .map(q => ({
      key: q.key.trim(),
      value: q.value ? q.value.trim() : '',
      disabled: q.disabled
    }))
    .sort((a, b) => a.key.localeCompare(b.key)); // Sort by key for canonical representation
}

/**
 * Normalizes form data parameters
 */
function normalizeFormData(formdata: any[] = []): FormDataParam[] {
  return formdata
    .filter(f => f.key && f.key.trim()) // Remove empty form data
    .map(f => ({
      key: f.key.trim(),
      value: f.value ? f.value.trim() : undefined,
      src: f.src,
      type: (f.type === 'file' ? 'file' : 'text') as 'text' | 'file',
      disabled: f.disabled
    }))
    .sort((a, b) => a.key.localeCompare(b.key)); // Sort by key for canonical representation
}

/**
 * Normalizes request body
 */
function normalizeBody(body: PostmanRequestBody = { mode: 'raw' }): NormalizedBody {
  const normalized: NormalizedBody = {
    mode: body.mode as any || 'raw'
  };

  switch (body.mode) {
    case 'raw':
      if (body.raw) {
        // Try to pretty-print JSON if it's JSON content
        try {
          const trimmed = body.raw.trim();
          if (body.options?.raw?.language === 'json' || 
              (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[')) {
            const parsed = JSON.parse(body.raw);
            normalized.raw = JSON.stringify(parsed, null, 2);
          } else {
            normalized.raw = trimmed;
          }
        } catch {
          normalized.raw = body.raw.trim();
        }
      }
      break;
    case 'formdata':
      normalized.formdata = normalizeFormData(body.formdata);
      break;
    case 'urlencoded':
      normalized.urlencoded = normalizeQueryParams(body.urlencoded);
      break;
    case 'file':
      normalized.file = body.file;
      break;
    case 'graphql':
      normalized.graphql = body.graphql;
      break;
  }

  return normalized;
}

/**
 * Extracts and normalizes scripts from events
 */
function extractScripts(events: PostmanEvent[] = []): { prerequest?: string; test?: string } {
  const scripts: { prerequest?: string; test?: string } = {};

  for (const event of events) {
    if (event.listen && event.script && event.script.exec) {
      const scriptContent = event.script.exec.join('\n').trim();
      if (scriptContent) {
        if (event.listen === 'prerequest') {
          scripts.prerequest = scriptContent;
        } else if (event.listen === 'test') {
          scripts.test = scriptContent;
        }
      }
    }
  }

  return scripts;
}

/**
 * Computes hashes for an AST node
 */
function computeHashes(node: AstNode): { structure: string; content?: string } {
  // Structure hash: based on type, name, and path
  const structureContent = node.type + ":" + node.name + ":" + node.path.join('/');
  const structure = generateHash(structureContent);

  let content: string | undefined;

  if (node.type === 'request' && node.data) {
    // Content hash: based on normalized request data
    const contentData = {
      method: node.data.method,
      url: node.data.url,
      headers: node.data.headers,
      query: node.data.query,
      body: node.data.body,
      scripts: node.data.scripts
    };
    content = generateHash(JSON.stringify(contentData));
  }

  return { structure, content };
}

/**
 * Recursively builds AST nodes from Postman items
 */
function buildNodeFromItem(
  item: PostmanItem,
  parentPath: string[],
  nodeMap: { [key: string]: AstNode }
): AstNode {
  const path = parentPath.concat([item.name]);
  const isRequest = !!item.request;
  const type: NodeType = isRequest ? 'request' : 'folder';

  let data: RequestData | undefined;
  let children: AstNode[] = [];

  if (isRequest && item.request) {
    // Build request data
    const url = normalizeUrl(item.request.url);
    const headers = normalizeHeaders(item.request.header);
    const query = normalizeQueryParams(
      typeof item.request.url === 'object' ? item.request.url.query : []
    );
    const body = normalizeBody(item.request.body);
    const scripts = extractScripts(item.event);

    data = {
      method: item.request.method.toUpperCase(),
      url,
      headers,
      query,
      body,
      scripts
    };
  } else if (item.item) {
    // Build children for folders
    children = item.item.map(childItem => buildNodeFromItem(childItem, path, nodeMap));
  }

  // Generate stable ID
  const id = generateStableId(
    type,
    path,
    data?.method,
    data?.url.raw || JSON.stringify(data?.url)
  );

  // Create node
  const node: AstNode = {
    id,
    type,
    name: item.name,
    path,
    children,
    data,
    hashes: { structure: '', content: undefined } // Will be computed below
  };

  // Compute hashes
  node.hashes = computeHashes(node);

  // Add to node map
  nodeMap[id] = node;

  return node;
}

/**
 * Main function to build AST from a normalized Postman collection
 * 
 * @param collection - Normalized Postman collection
 * @returns AST result with tree and flat map
 */
export function buildAST(collection: PostmanCollection): AstResult {
  const nodeMap: { [key: string]: AstNode } = {};
  
  // Build children from collection items
  const children = (collection.item || []).map(item => 
    buildNodeFromItem(item, [collection.info.name], nodeMap)
  );

  // Create root collection node
  const rootPath = [collection.info.name];
  const rootId = generateStableId('collection', rootPath);

  const rootNode: AstNode = {
    id: rootId,
    type: 'collection',
    name: collection.info.name,
    path: rootPath,
    children,
    hashes: { structure: '', content: undefined }
  };

  // Compute hashes for root
  rootNode.hashes = computeHashes(rootNode);

  // Add root to node map
  nodeMap[rootId] = rootNode;

  return {
    tree: rootNode,
    nodeMap
  };
}

/**
 * Flattens the AST tree into a map for quick lookups by ID
 * (Alternative approach if you prefer a separate flattening function)
 */
export function flattenAST(tree: AstNode): { [key: string]: AstNode } {
  const map: { [key: string]: AstNode } = {};
  
  function traverse(node: AstNode): void {
    map[node.id] = node;
    for (let i = 0; i < node.children.length; i++) {
      traverse(node.children[i]);
    }
  }
  
  traverse(tree);
  return map;
}

/**
 * Gets all nodes of a specific type from the AST
 */
export function getNodesByType(tree: AstNode, type: NodeType): AstNode[] {
  const nodes: AstNode[] = [];
  
  function traverse(node: AstNode): void {
    if (node.type === type) {
      nodes.push(node);
    }
    for (let i = 0; i < node.children.length; i++) {
      traverse(node.children[i]);
    }
  }
  
  traverse(tree);
  return nodes;
}

/**
 * Finds a node by its stable ID
 */
export function findNodeById(tree: AstNode, id: string): AstNode | undefined {
  if (tree.id === id) {
    return tree;
  }
  
  for (let i = 0; i < tree.children.length; i++) {
    const found = findNodeById(tree.children[i], id);
    if (found) {
      return found;
    }
  }
  
  return undefined;
}