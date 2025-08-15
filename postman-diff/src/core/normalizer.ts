import type { PostmanCollection, NormalizedCollection, NormalizedItem } from '../types'

/**
 * Normalizes a Postman collection for comparison
 */
export class PostmanNormalizer {
  /**
   * Normalizes a Postman collection to a standardized format
   */
  static normalize(collection: PostmanCollection): NormalizedCollection {
    return {
      info: {
        name: collection.info.name,
        version: collection.info.version,
      },
      items: this.normalizeItems(collection.item),
    }
  }

  /**
   * Recursively normalizes collection items
   */
  private static normalizeItems(items: any[]): NormalizedItem[] {
    return items.map(item => this.normalizeItem(item))
  }

  /**
   * Normalizes a single collection item
   */
  private static normalizeItem(item: any): NormalizedItem {
    const normalized: NormalizedItem = {
      id: item.id || this.generateId(item.name),
      name: item.name,
    }

    // Handle request items
    if (item.request) {
      normalized.method = item.request.method
      normalized.url = this.normalizeUrl(item.request.url)
      normalized.headers = this.normalizeHeaders(item.request.header)
      normalized.body = this.normalizeBody(item.request.body)
    }

    // Handle folder items (recursive)
    if (item.item && Array.isArray(item.item)) {
      normalized.children = this.normalizeItems(item.item)
    }

    // Handle test scripts
    if (item.event) {
      normalized.tests = this.normalizeEvents(item.event)
    }

    return normalized
  }

  /**
   * Normalizes URL to string format
   */
  private static normalizeUrl(url: any): string {
    if (typeof url === 'string') return url
    return url?.raw || ''
  }

  /**
   * Normalizes headers to key-value object
   */
  private static normalizeHeaders(headers: any[]): Record<string, string> {
    if (!headers) return {}

    return headers
      .filter(h => !h.disabled)
      .reduce(
        (acc, header) => {
          acc[header.key] = header.value
          return acc
        },
        {} as Record<string, string>
      )
  }

  /**
   * Normalizes request body
   */
  private static normalizeBody(body: any): string {
    if (!body) return ''

    switch (body.mode) {
      case 'raw':
        return body.raw || ''
      case 'urlencoded':
        return this.formatUrlEncoded(body.urlencoded)
      case 'formdata':
        return this.formatFormData(body.formdata)
      default:
        return JSON.stringify(body)
    }
  }

  /**
   * Normalizes event scripts
   */
  private static normalizeEvents(events: any[]): string[] {
    return events.filter(event => event.script?.exec).map(event => event.script.exec.join('\n'))
  }

  /**
   * Formats URL encoded data
   */
  private static formatUrlEncoded(data: any[]): string {
    if (!data) return ''
    return data
      .filter(item => !item.disabled)
      .map(item => `${item.key}=${item.value}`)
      .join('&')
  }

  /**
   * Formats form data
   */
  private static formatFormData(data: any[]): string {
    if (!data) return ''
    return data
      .filter(item => !item.disabled)
      .map(item => `${item.key}: ${item.value}`)
      .join('\n')
  }

  /**
   * Generates a consistent ID from name
   */
  private static generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }
}
