import { createPatch, diffJson } from 'diff'
import { html } from 'diff2html'
import type { Change } from 'diff'
import type { PostmanCollection, DiffResult, DiffOptions, NormalizedCollection } from '../types'
import { PostmanNormalizer } from './normalizer'

/**
 * Creates diffs between Postman collections
 */
export class PostmanDiffer {
  private options: DiffOptions

  constructor(options: DiffOptions = {}) {
    this.options = {
      ignoreOrder: false,
      ignoreWhitespace: true,
      normalizeJson: true,
      sortKeys: true,
      ...options,
    }
  }

  /**
   * Creates a diff between two Postman collections
   */
  diff(oldCollection: PostmanCollection, newCollection: PostmanCollection): DiffResult {
    // Normalize collections
    const normalizedOld = PostmanNormalizer.normalize(oldCollection)
    const normalizedNew = PostmanNormalizer.normalize(newCollection)

    // Convert to comparable strings
    const oldString = this.serializeForComparison(normalizedOld)
    const newString = this.serializeForComparison(normalizedNew)

    // Create diff patches
    const patches = diffJson(oldString, newString)

    // Create unified diff patch
    const unifiedPatch = createPatch(
      oldCollection.info.name || 'Old Collection',
      newCollection.info.name || 'New Collection',
      oldString,
      newString
    )

    // Generate HTML diff
    const htmlDiff = html(unifiedPatch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side',
    })

    return {
      oldCollection: oldString,
      newCollection: newString,
      patches,
      htmlDiff,
    }
  }

  /**
   * Serializes normalized collection for comparison
   */
  private serializeForComparison(collection: NormalizedCollection): string {
    let serialized = { ...collection }

    if (this.options.sortKeys) {
      serialized = this.sortObjectKeys(serialized)
    }

    if (this.options.ignoreOrder && serialized.items) {
      serialized.items = this.sortItems(serialized.items)
    }

    let jsonString = JSON.stringify(serialized, null, 2)

    if (this.options.ignoreWhitespace) {
      jsonString = this.normalizeWhitespace(jsonString)
    }

    return jsonString
  }

  /**
   * Recursively sorts object keys
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item))
    }

    const sorted: any = {}
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortObjectKeys(obj[key])
      })

    return sorted
  }

  /**
   * Sorts items by name for consistent ordering
   */
  private sortItems(items: any[]): any[] {
    return items
      .map(item => ({
        ...item,
        children: item.children ? this.sortItems(item.children) : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Normalizes whitespace for comparison
   */
  private normalizeWhitespace(str: string): string {
    return str
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}[\],:])\s*/g, '$1')
      .trim()
  }

  /**
   * Gets a summary of changes
   */
  getChangeSummary(patches: Change[]): {
    added: number
    removed: number
    modified: number
  } {
    let added = 0
    let removed = 0
    let modified = 0

    patches.forEach(patch => {
      if (patch.added) {
        added++
      } else if (patch.removed) {
        removed++
      } else {
        modified++
      }
    })

    return { added, removed, modified }
  }
}
