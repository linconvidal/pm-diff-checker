/**
 * Postman Collection v2.1 Parser and Validator
 */

export interface PostmanCollection {
  info: {
    _postman_id?: string;
    name: string;
    schema: string;
    _exporter_id?: string;
    _collection_link?: string;
    description?: string;
    [key: string]: any;
  };
  item: PostmanItem[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
  [key: string]: any;
}

export interface PostmanItem {
  id?: string;
  name: string;
  description?: string;
  item?: PostmanItem[]; // for folders
  request?: PostmanRequest;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
  [key: string]: any;
}

export interface PostmanRequest {
  url: string | PostmanUrl;
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
  description?: string;
  [key: string]: any;
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
  [key: string]: any;
}

export interface PostmanHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
  [key: string]: any;
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
  [key: string]: any;
}

export interface PostmanBody {
  mode?: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql';
  raw?: string;
  formdata?: PostmanFormParam[];
  urlencoded?: PostmanFormParam[];
  file?: {
    src: string;
    [key: string]: any;
  };
  graphql?: {
    query?: string;
    variables?: string;
    [key: string]: any;
  };
  options?: {
    raw?: {
      language?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PostmanFormParam {
  key: string;
  value?: string;
  type?: 'text' | 'file';
  src?: string | string[];
  description?: string;
  disabled?: boolean;
  [key: string]: any;
}

export interface PostmanEvent {
  listen: string;
  script?: PostmanScript;
  disabled?: boolean;
  [key: string]: any;
}

export interface PostmanScript {
  id?: string;
  type?: string;
  exec?: string[];
  src?: string;
  packages?: Record<string, any>;
  [key: string]: any;
}

export interface PostmanVariable {
  id?: string;
  key: string;
  value: any;
  type?: string;
  description?: string;
  [key: string]: any;
}

export interface PostmanAuth {
  type: string;
  [key: string]: any;
}

export interface PostmanResponse {
  id?: string;
  name?: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
  [key: string]: any;
}

export class ParseError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ParseError';
    this.cause = cause;
  }
}

/**
 * Parse and validate a Postman Collection v2.1 JSON string or object
 */
export function parseCollection(input: string | unknown): PostmanCollection {
  let data: unknown;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new ParseError('Invalid JSON format', error);
    }
  } else {
    data = input;
  }

  if (!isObject(data)) {
    throw new ParseError('Collection must be an object');
  }

  // Validate schema
  if (!data.info || !isObject(data.info)) {
    throw new ParseError('Collection must have an info object');
  }

  const info = data.info as Record<string, any>;
  if (typeof info.name !== 'string') {
    throw new ParseError('Collection info.name must be a string');
  }

  if (typeof info.schema !== 'string') {
    throw new ParseError('Collection info.schema must be a string');
  }

  // Check if it's a v2.1 schema
  const schema = info.schema.toLowerCase();
  if (!schema.includes('v2.1') && !schema.includes('2.1')) {
    throw new ParseError(`Unsupported schema version: ${info.schema}. Only Postman Collection v2.1 is supported.`);
  }

  // Validate items array
  if (!Array.isArray(data.item)) {
    throw new ParseError('Collection must have an items array');
  }

  // Basic validation of items structure
  for (let i = 0; i < data.item.length; i++) {
    const item = data.item[i];
    if (!isObject(item)) {
      throw new ParseError(`Item at index ${i} must be an object`);
    }
    if (typeof item.name !== 'string') {
      throw new ParseError(`Item at index ${i} must have a name string`);
    }
  }

  return data as PostmanCollection;
}

/**
 * Load and parse a collection from a file or JSON string
 */
export async function loadCollection(source: string | File): Promise<PostmanCollection> {
  let jsonString: string;

  if (source instanceof File) {
    try {
      jsonString = await source.text();
    } catch (error) {
      throw new ParseError('Failed to read file', error);
    }
  } else {
    jsonString = source;
  }

  return parseCollection(jsonString);
}

/**
 * Validate that the collection has the expected structure for normalization
 */
export function validateCollectionStructure(collection: PostmanCollection): void {
  // Additional structural validation for normalization
  if (collection.item) {
    validateItems(collection.item, []);
  }
}

function validateItems(items: PostmanItem[], path: string[]): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemPath = [...path, item.name];

    // If it has request, it's a request item
    if (item.request) {
      validateRequest(item.request, itemPath);
    }

    // If it has items, it's a folder
    if (item.item && Array.isArray(item.item)) {
      validateItems(item.item, itemPath);
    }
  }
}

function validateRequest(request: PostmanRequest, path: string[]): void {
  if (typeof request.method !== 'string') {
    throw new ParseError(`Request at ${path.join('/')} must have a method string`);
  }

  if (request.url !== undefined && typeof request.url !== 'string' && !isObject(request.url)) {
    throw new ParseError(`Request at ${path.join('/')} URL must be a string or object`);
  }
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}