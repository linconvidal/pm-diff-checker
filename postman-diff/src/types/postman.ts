// Postman Collection types
export interface PostmanCollection {
  info: {
    _postman_id: string
    name: string
    schema: string
    version?: string
  }
  item: PostmanItem[]
  event?: PostmanEvent[]
  variable?: PostmanVariable[]
  auth?: PostmanAuth
}

export interface PostmanItem {
  name: string
  id?: string
  request?: PostmanRequest
  response?: PostmanResponse[]
  event?: PostmanEvent[]
  item?: PostmanItem[] // For folders
}

export interface PostmanRequest {
  method: string
  header?: PostmanHeader[]
  body?: PostmanRequestBody
  url: PostmanUrl | string
  auth?: PostmanAuth
  description?: string
}

export interface PostmanUrl {
  raw: string
  protocol?: string
  host?: string[]
  port?: string
  path?: string[]
  query?: PostmanQueryParam[]
  hash?: string
}

export interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export interface PostmanQueryParam {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export interface PostmanRequestBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql'
  raw?: string
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>
  formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>
  file?: { src?: string }
  graphql?: { query: string; variables?: string }
  options?: {
    raw?: { language: string }
  }
}

export interface PostmanResponse {
  name: string
  originalRequest: PostmanRequest
  status: string
  code: number
  _postman_previewlanguage?: string
  header: PostmanHeader[]
  cookie: any[]
  body: string
}

export interface PostmanEvent {
  listen: string
  script: {
    type: string
    exec: string[]
  }
}

export interface PostmanVariable {
  key: string
  value: string
  type?: string
  disabled?: boolean
}

export interface PostmanAuth {
  type: string
  [key: string]: any
}
