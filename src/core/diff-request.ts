/**
 * Request diff algorithm for detecting content changes in Postman requests
 * Implements section 4.2 of the specifications
 */

import { createPatch, diffJson } from 'diff'
import { html } from 'diff2html'
import type { NormalizedRequest, NormalizedHeader, NormalizedQueryParam, NormalizedBody } from './normalize'

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

/**
 * Diff two normalized requests and generate detailed change information
 */
export function diffRequests(
  oldRequest: NormalizedRequest | undefined,
  newRequest: NormalizedRequest | undefined,
  requestName: string = 'request'
): RequestDiffResult {
  // Handle cases where one request is missing
  if (!oldRequest && !newRequest) {
    return {
      hasChanges: false,
      fieldChanges: [],
      patches: {}
    }
  }

  if (!oldRequest) {
    return {
      hasChanges: true,
      fieldChanges: [
        {
          field: 'method',
          changeType: 'added',
          reason: 'Request was added'
        }
      ],
      patches: generateAddedRequestPatches(newRequest!, requestName)
    }
  }

  if (!newRequest) {
    return {
      hasChanges: true,
      fieldChanges: [
        {
          field: 'method',
          changeType: 'removed',
          reason: 'Request was removed'
        }
      ],
      patches: generateRemovedRequestPatches(oldRequest, requestName)
    }
  }

  // Compare requests field by field
  const fieldChanges: FieldChangeResult[] = []
  const patches: RequestPatchResult = {}

  // Method comparison
  const methodChange = compareMethod(oldRequest.method, newRequest.method)
  fieldChanges.push(methodChange)
  if (methodChange.patch) {
    patches.method = {
      patch: methodChange.patch,
      htmlDiff: methodChange.htmlDiff!,
      hasChanges: methodChange.changeType !== 'unchanged'
    }
  }

  // URL comparison
  const urlChange = compareUrl(oldRequest.url, newRequest.url)
  fieldChanges.push(urlChange)
  if (urlChange.patch) {
    patches.url = {
      patch: urlChange.patch,
      htmlDiff: urlChange.htmlDiff!,
      hasChanges: urlChange.changeType !== 'unchanged'
    }
  }

  // Headers comparison
  const headersChange = compareHeaders(oldRequest.headers, newRequest.headers)
  fieldChanges.push(headersChange)
  if (headersChange.patch) {
    patches.headers = {
      patch: headersChange.patch,
      htmlDiff: headersChange.htmlDiff!,
      hasChanges: headersChange.changeType !== 'unchanged'
    }
  }

  // Query parameters comparison
  const queryChange = compareQueryParams(oldRequest.query, newRequest.query)
  fieldChanges.push(queryChange)
  if (queryChange.patch) {
    patches.query = {
      patch: queryChange.patch,
      htmlDiff: queryChange.htmlDiff!,
      hasChanges: queryChange.changeType !== 'unchanged'
    }
  }

  // Body comparison
  const bodyChange = compareBody(oldRequest.body, newRequest.body)
  fieldChanges.push(bodyChange)
  if (bodyChange.patch) {
    patches.body = {
      patch: bodyChange.patch,
      htmlDiff: bodyChange.htmlDiff!,
      hasChanges: bodyChange.changeType !== 'unchanged'
    }
  }

  // Determine if there are any changes
  const hasChanges = fieldChanges.some(change => change.changeType !== 'unchanged')

  return {
    hasChanges,
    fieldChanges,
    patches
  }
}

/**
 * Compare request methods
 */
function compareMethod(oldMethod: string, newMethod: string): FieldChangeResult {
  if (oldMethod === newMethod) {
    return {
      field: 'method',
      changeType: 'unchanged'
    }
  }

  const patch = createPatch(
    'method',
    oldMethod,
    newMethod,
    'old method',
    'new method'
  )

  const htmlDiff = html(patch, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  })

  return {
    field: 'method',
    changeType: 'modified',
    reason: `Method changed from ${oldMethod} to ${newMethod}`,
    patch,
    htmlDiff
  }
}

/**
 * Compare URLs (handles both string and normalized formats)
 */
function compareUrl(oldUrl: any, newUrl: any): FieldChangeResult {
  const oldUrlStr = serializeUrl(oldUrl)
  const newUrlStr = serializeUrl(newUrl)

  if (oldUrlStr === newUrlStr) {
    return {
      field: 'url',
      changeType: 'unchanged'
    }
  }

  const patch = createPatch(
    'url',
    oldUrlStr,
    newUrlStr,
    'old url',
    'new url'
  )

  const htmlDiff = html(patch, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  })

  return {
    field: 'url',
    changeType: 'modified',
    reason: 'URL changed',
    patch,
    htmlDiff
  }
}

/**
 * Compare headers with structured analysis
 */
function compareHeaders(oldHeaders: NormalizedHeader[], newHeaders: NormalizedHeader[]): FieldChangeResult {
  const oldHeadersStr = serializeHeaders(oldHeaders)
  const newHeadersStr = serializeHeaders(newHeaders)

  if (oldHeadersStr === newHeadersStr) {
    return {
      field: 'headers',
      changeType: 'unchanged'
    }
  }

  // Generate detailed change reasons
  const oldHeaderMap = new Map(oldHeaders.map(h => [h.key.toLowerCase(), h]))
  const newHeaderMap = new Map(newHeaders.map(h => [h.key.toLowerCase(), h]))

  const changes: string[] = []

  // Check for removed headers
  for (const [key, header] of oldHeaderMap) {
    if (!newHeaderMap.has(key)) {
      changes.push(`Removed header: ${header.key}`)
    }
  }

  // Check for added and modified headers
  for (const [key, newHeader] of newHeaderMap) {
    const oldHeader = oldHeaderMap.get(key)
    if (!oldHeader) {
      changes.push(`Added header: ${newHeader.key} = ${newHeader.value}`)
    } else if (oldHeader.value !== newHeader.value) {
      changes.push(`Modified header: ${newHeader.key} (${oldHeader.value} → ${newHeader.value})`)
    }
  }

  const patch = createPatch(
    'headers',
    oldHeadersStr,
    newHeadersStr,
    'old headers',
    'new headers'
  )

  const htmlDiff = html(patch, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  })

  return {
    field: 'headers',
    changeType: 'modified',
    reason: changes.length > 0 ? changes.join('; ') : 'Headers changed',
    patch,
    htmlDiff
  }
}

/**
 * Compare query parameters with structured analysis
 */
function compareQueryParams(oldQuery: NormalizedQueryParam[], newQuery: NormalizedQueryParam[]): FieldChangeResult {
  const oldQueryStr = serializeQueryParams(oldQuery)
  const newQueryStr = serializeQueryParams(newQuery)

  if (oldQueryStr === newQueryStr) {
    return {
      field: 'query',
      changeType: 'unchanged'
    }
  }

  // Generate detailed change reasons
  const oldQueryMap = new Map(oldQuery.map(q => [q.key, q]))
  const newQueryMap = new Map(newQuery.map(q => [q.key, q]))

  const changes: string[] = []

  // Check for removed query parameters
  for (const [key, param] of oldQueryMap) {
    if (!newQueryMap.has(key)) {
      changes.push(`Removed query param: ${param.key}`)
    }
  }

  // Check for added and modified query parameters
  for (const [key, newParam] of newQueryMap) {
    const oldParam = oldQueryMap.get(key)
    if (!oldParam) {
      changes.push(`Added query param: ${newParam.key} = ${newParam.value}`)
    } else if (oldParam.value !== newParam.value) {
      changes.push(`Modified query param: ${newParam.key} (${oldParam.value} → ${newParam.value})`)
    }
  }

  const patch = createPatch(
    'query',
    oldQueryStr,
    newQueryStr,
    'old query params',
    'new query params'
  )

  const htmlDiff = html(patch, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  })

  return {
    field: 'query',
    changeType: 'modified',
    reason: changes.length > 0 ? changes.join('; ') : 'Query parameters changed',
    patch,
    htmlDiff
  }
}

/**
 * Compare request bodies with special handling for JSON
 */
function compareBody(oldBody: NormalizedBody, newBody: NormalizedBody): FieldChangeResult {
  const oldBodyStr = serializeBody(oldBody)
  const newBodyStr = serializeBody(newBody)

  if (oldBodyStr === newBodyStr) {
    return {
      field: 'body',
      changeType: 'unchanged'
    }
  }

  let patch: string
  let htmlDiff: string

  // Try JSON diff first for better visualization
  if (isJsonBody(oldBody) && isJsonBody(newBody)) {
    try {
      const oldJson = JSON.parse(oldBody.content || '{}')
      const newJson = JSON.parse(newBody.content || '{}')
      
      // Use structured JSON diff for comparison (helps detect changes)
      diffJson(oldJson, newJson)
      
      // Create textual representation for HTML diff
      const oldJsonStr = JSON.stringify(oldJson, null, 2)
      const newJsonStr = JSON.stringify(newJson, null, 2)
      
      patch = createPatch(
        'body',
        oldJsonStr,
        newJsonStr,
        'old body',
        'new body'
      )
      
      htmlDiff = html(patch, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side'
      })
    } catch {
      // Fallback to regular text diff if JSON parsing fails
      patch = createPatch(
        'body',
        oldBodyStr,
        newBodyStr,
        'old body',
        'new body'
      )

      htmlDiff = html(patch, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side'
      })
    }
  } else {
    // Regular text diff
    patch = createPatch(
      'body',
      oldBodyStr,
      newBodyStr,
      'old body',
      'new body'
    )

    htmlDiff = html(patch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side'
    })
  }

  const reason = getBodyChangeReason(oldBody, newBody)

  return {
    field: 'body',
    changeType: 'modified',
    reason,
    patch,
    htmlDiff
  }
}

/**
 * Compare scripts with line-based diffing
 */
export function compareScripts(
  oldScript: string | undefined,
  newScript: string | undefined,
  scriptType: 'prerequest' | 'test'
): FieldChangeResult {
  const oldScriptStr = oldScript || ''
  const newScriptStr = newScript || ''

  if (oldScriptStr === newScriptStr) {
    return {
      field: scriptType === 'prerequest' ? 'prerequestScript' : 'testScript',
      changeType: 'unchanged'
    }
  }

  // Use line-based diff for better script comparison
  const patch = createPatch(
    `${scriptType}-script`,
    oldScriptStr,
    newScriptStr,
    `old ${scriptType} script`,
    `new ${scriptType} script`
  )

  const htmlDiff = html(patch, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  })

  let changeType: 'added' | 'removed' | 'modified' = 'modified'
  let reason = `${scriptType} script changed`

  if (!oldScriptStr && newScriptStr) {
    changeType = 'added'
    reason = `${scriptType} script added`
  } else if (oldScriptStr && !newScriptStr) {
    changeType = 'removed'
    reason = `${scriptType} script removed`
  }

  return {
    field: scriptType === 'prerequest' ? 'prerequestScript' : 'testScript',
    changeType,
    reason,
    patch,
    htmlDiff
  }
}

// Helper functions for serialization

function serializeUrl(url: any): string {
  if (typeof url === 'string') {
    return url
  }

  if (url && typeof url === 'object') {
    if (url.raw) {
      return url.raw
    }
    
    // Reconstruct URL from components
    const protocol = url.protocol ? `${url.protocol}://` : ''
    const host = url.host || ''
    const path = url.path || ''
    const query = url.query ? `?${url.query}` : ''
    
    return `${protocol}${host}${path}${query}`
  }

  return ''
}

function serializeHeaders(headers: NormalizedHeader[]): string {
  return headers
    .map(h => `${h.key}: ${h.value}`)
    .join('\n')
}

function serializeQueryParams(params: NormalizedQueryParam[]): string {
  return params
    .map(p => `${p.key}=${p.value}`)
    .join('\n')
}

function serializeBody(body: NormalizedBody): string {
  if (!body.content) {
    return ''
  }

  const modePrefix = body.mode ? `[${body.mode.toUpperCase()}]\n` : ''
  const contentTypePrefix = body.contentType ? `Content-Type: ${body.contentType}\n\n` : ''
  
  return `${modePrefix}${contentTypePrefix}${body.content}`
}

function isJsonBody(body: NormalizedBody): boolean {
  return body.contentType === 'json' || 
         (!!body.content?.trim().startsWith('{') && !!body.content?.trim().endsWith('}')) ||
         (!!body.content?.trim().startsWith('[') && !!body.content?.trim().endsWith(']'))
}

function getBodyChangeReason(oldBody: NormalizedBody, newBody: NormalizedBody): string {
  if (oldBody.mode !== newBody.mode) {
    return `Body mode changed from ${oldBody.mode || 'none'} to ${newBody.mode || 'none'}`
  }

  if (oldBody.contentType !== newBody.contentType) {
    return `Content-Type changed from ${oldBody.contentType || 'none'} to ${newBody.contentType || 'none'}`
  }

  if (!oldBody.content && newBody.content) {
    return 'Body content added'
  }

  if (oldBody.content && !newBody.content) {
    return 'Body content removed'
  }

  return 'Body content changed'
}

// Helper functions for handling added/removed requests

function generateAddedRequestPatches(request: NormalizedRequest, _requestName: string): RequestPatchResult {
  const patches: RequestPatchResult = {}

  // Method
  const methodPatch = createPatch(
    'method',
    '',
    request.method,
    'no method',
    'new method'
  )
  patches.method = {
    patch: methodPatch,
    htmlDiff: html(methodPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
    hasChanges: true
  }

  // URL
  const urlStr = serializeUrl(request.url)
  const urlPatch = createPatch(
    'url',
    '',
    urlStr,
    'no url',
    'new url'
  )
  patches.url = {
    patch: urlPatch,
    htmlDiff: html(urlPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
    hasChanges: true
  }

  // Headers
  if (request.headers.length > 0) {
    const headersStr = serializeHeaders(request.headers)
    const headersPatch = createPatch(
      'headers',
      '',
      headersStr,
      'no headers',
      'new headers'
    )
    patches.headers = {
      patch: headersPatch,
      htmlDiff: html(headersPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
      hasChanges: true
    }
  }

  // Query parameters
  if (request.query.length > 0) {
    const queryStr = serializeQueryParams(request.query)
    const queryPatch = createPatch(
      'query',
      '',
      queryStr,
      'no query params',
      'new query params'
    )
    patches.query = {
      patch: queryPatch,
      htmlDiff: html(queryPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
      hasChanges: true
    }
  }

  // Body
  if (request.body.content) {
    const bodyStr = serializeBody(request.body)
    const bodyPatch = createPatch(
      'body',
      '',
      bodyStr,
      'no body',
      'new body'
    )
    patches.body = {
      patch: bodyPatch,
      htmlDiff: html(bodyPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
      hasChanges: true
    }
  }

  return patches
}

function generateRemovedRequestPatches(request: NormalizedRequest, _requestName: string): RequestPatchResult {
  const patches: RequestPatchResult = {}

  // Method
  const methodPatch = createPatch(
    'method',
    request.method,
    '',
    'old method',
    'no method'
  )
  patches.method = {
    patch: methodPatch,
    htmlDiff: html(methodPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
    hasChanges: true
  }

  // URL
  const urlStr = serializeUrl(request.url)
  const urlPatch = createPatch(
    'url',
    urlStr,
    '',
    'old url',
    'no url'
  )
  patches.url = {
    patch: urlPatch,
    htmlDiff: html(urlPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
    hasChanges: true
  }

  // Headers
  if (request.headers.length > 0) {
    const headersStr = serializeHeaders(request.headers)
    const headersPatch = createPatch(
      'headers',
      headersStr,
      '',
      'old headers',
      'no headers'
    )
    patches.headers = {
      patch: headersPatch,
      htmlDiff: html(headersPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
      hasChanges: true
    }
  }

  // Query parameters
  if (request.query.length > 0) {
    const queryStr = serializeQueryParams(request.query)
    const queryPatch = createPatch(
      'query',
      queryStr,
      '',
      'old query params',
      'no query params'
    )
    patches.query = {
      patch: queryPatch,
      htmlDiff: html(queryPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
      hasChanges: true
    }
  }

  // Body
  if (request.body.content) {
    const bodyStr = serializeBody(request.body)
    const bodyPatch = createPatch(
      'body',
      bodyStr,
      '',
      'old body',
      'no body'
    )
    patches.body = {
      patch: bodyPatch,
      htmlDiff: html(bodyPatch, { drawFileList: false, outputFormat: 'side-by-side' }),
      hasChanges: true
    }
  }

  return patches
}