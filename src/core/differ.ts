import { diffLines } from 'diff'
import type { Change } from 'diff'
import type { PostmanCollection, DiffResult, NormalizedCollection } from '../types'
import { PostmanNormalizer } from './normalizer'

/**
 * Creates diffs between Postman collections
 */
export class PostmanDiffer {
  constructor() {
  }

  /**
   * Creates a diff between two Postman collections
   */
  diff(oldCollection: PostmanCollection, newCollection: PostmanCollection): DiffResult {
    // Normalize collections
    const normalizedOld = PostmanNormalizer.normalize(oldCollection)
    const normalizedNew = PostmanNormalizer.normalize(newCollection)

    // Create item-by-item diff instead of full JSON comparison
    const itemDiffs = this.createItemDiffs(normalizedOld, normalizedNew)
    
    // Generate HTML diff from item changes
    const htmlDiff = this.generateItemBasedHtml(itemDiffs)

    // Create minimal patches for compatibility (not the full JSON!)
    const patches: Change[] = []
    itemDiffs.forEach(diff => {
      if (diff.type === 'added') {
        patches.push({ added: true, removed: false, value: diff.item.name, count: 1 } as Change)
      } else if (diff.type === 'removed') {
        patches.push({ added: false, removed: true, value: diff.item.name, count: 1 } as Change)
      } else if (diff.type === 'modified') {
        patches.push({ added: false, removed: false, value: diff.item.name, count: 1 } as Change)
      }
    })

    return {
      oldCollection: JSON.stringify({ name: normalizedOld.info.name, itemCount: normalizedOld.items?.length || 0 }),
      newCollection: JSON.stringify({ name: normalizedNew.info.name, itemCount: normalizedNew.items?.length || 0 }),
      patches,
      htmlDiff,
    }
  }

  /**
   * Creates item-by-item diffs between collections
   */
  private createItemDiffs(oldCollection: NormalizedCollection, newCollection: NormalizedCollection): any[] {
    const diffs: any[] = []
    
    const oldItems = this.flattenItems(oldCollection.items || [])
    const newItems = this.flattenItems(newCollection.items || [])
    
    const oldMap = new Map(oldItems.map(item => [item.id, item]))
    const newMap = new Map(newItems.map(item => [item.id, item]))
    
    // Find removed items
    oldMap.forEach((item, id) => {
      if (!newMap.has(id)) {
        diffs.push({ type: 'removed', item })
      }
    })
    
    // Find added and modified items
    newMap.forEach((item, id) => {
      if (!oldMap.has(id)) {
        diffs.push({ type: 'added', item })
      } else {
        const oldItem = oldMap.get(id)
        if (this.hasItemChanged(oldItem, item)) {
          diffs.push({ type: 'modified', item, oldItem, changes: this.getItemChanges(oldItem, item) })
        }
      }
    })
    
    return diffs
  }

  /**
   * Flattens nested items structure with path tracking
   */
  private flattenItems(items: any[], result: any[] = [], parentPath: string = ''): any[] {
    items.forEach(item => {
      const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const itemWithPath = { ...item, path: currentPath, parentPath }
      result.push(itemWithPath)
      if (item.children) {
        this.flattenItems(item.children, result, currentPath)
      }
    })
    return result
  }

  /**
   * Checks if an item has changed
   */
  private hasItemChanged(oldItem: any, newItem: any): boolean {
    return oldItem.method !== newItem.method ||
           oldItem.url !== newItem.url ||
           oldItem.body !== newItem.body ||
           JSON.stringify(oldItem.headers) !== JSON.stringify(newItem.headers) ||
           JSON.stringify(oldItem.tests) !== JSON.stringify(newItem.tests)
  }

  /**
   * Gets specific changes between items
   */
  private getItemChanges(oldItem: any, newItem: any): string[] {
    const changes: string[] = []
    
    if (oldItem.method !== newItem.method) {
      changes.push(`Method: ${oldItem.method} → ${newItem.method}`)
    }
    if (oldItem.url !== newItem.url) {
      changes.push(`URL: ${oldItem.url} → ${newItem.url}`)
    }
    if (oldItem.body !== newItem.body) {
      changes.push('Body modified')
    }
    if (JSON.stringify(oldItem.headers) !== JSON.stringify(newItem.headers)) {
      changes.push('Headers modified')
    }
    if (JSON.stringify(oldItem.tests) !== JSON.stringify(newItem.tests)) {
      changes.push('Tests modified')
    }
    
    return changes
  }

  /**
   * Generates HTML diff view from item changes
   */
  private generateItemBasedHtml(itemDiffs: any[]): string {
    let html = '<div class="d2h-wrapper">'
    
    // Group diffs by type for better organization
    const added = itemDiffs.filter(d => d.type === 'added')
    const removed = itemDiffs.filter(d => d.type === 'removed')
    const modified = itemDiffs.filter(d => d.type === 'modified')
    
    // Show removed endpoints
    if (removed.length > 0) {
      html += this.createSection('Removed Endpoints', removed, 'removed', 'removed-section')
    }
    
    // Show added endpoints
    if (added.length > 0) {
      html += this.createSection('Added Endpoints', added, 'added', 'added-section')
    }
    
    // Show modified endpoints with detailed changes
    if (modified.length > 0) {
      html += '<div class="d2h-file-wrapper" id="modified-section">'
      html += '<div class="d2h-file-header">'
      html += '<span class="d2h-file-name">Modified Endpoints</span>'
      html += '</div>'
      
      modified.forEach((diff) => {
        html += `<div class="d2h-file-diff" id="modified-${diff.item.id}">`
        html += `<div class="modified-endpoint-header">`
        
        // Show path hierarchy
        if (diff.item.parentPath) {
          html += `<span class="path-hierarchy">${this.escapeHtml(diff.item.parentPath)} › </span>`
        }
        html += `<strong>${this.escapeHtml(diff.item.name)}</strong>`
        
        if (diff.item.method && diff.item.url) {
          html += ` <span class="endpoint-info">[${diff.item.method} ${this.escapeHtml(diff.item.url)}]</span>`
        }
        
        // Show what changed
        const changeTypes = this.getChangeTypes(diff.oldItem, diff.item)
        if (changeTypes.length > 0) {
          html += ` <span class="change-summary">(${changeTypes.join(', ')})</span>`
        }
        
        html += '</div>'
        
        // Show detailed changes for each modified item
        if (diff.oldItem && diff.item) {
          html += this.generateDetailedChanges(diff.oldItem, diff.item)
        }
        
        html += '</div>'
      })
      
      html += '</div>'
    }
    
    html += '</div>'
    return html
  }
  
  /**
   * Creates a section for added/removed items
   */
  private createSection(title: string, items: any[], type: string, id: string): string {
    let html = `<div class="d2h-file-wrapper" id="${id}">`
    html += '<div class="d2h-file-header">'
    html += `<span class="d2h-file-name">${title}</span>`
    html += '</div>'
    html += '<div class="d2h-file-diff">'
    html += '<table class="d2h-diff-table">'
    html += '<tbody class="d2h-diff-tbody">'
    
    items.forEach(diff => {
      const cssClass = type === 'added' ? 'd2h-ins' : 'd2h-del'
      const prefix = type === 'added' ? '+' : '-'
      const itemId = type === 'added' ? `added-${diff.item.id}` : `removed-${diff.item.id}`
      
      // Get path from parent folders
      this.getItemPath(diff.item)
      
      html += `<tr id="${itemId}">`
      html += `<td class="d2h-code-linenumber ${cssClass}">${prefix}</td>`
      html += `<td class="${cssClass}"><div class="d2h-code-line">`
      
      // Show consistent format for all items
      if (diff.item.parentPath) {
        html += `${prefix} ${this.escapeHtml(diff.item.parentPath)} › `
      }
      html += `<strong>${this.escapeHtml(diff.item.name)}</strong>`
      
      if (diff.item.method && diff.item.url) {
        html += ` <span style="opacity: 0.7;">[${diff.item.method} ${this.escapeHtml(diff.item.url)}]</span>`
      } else if (diff.item.children) {
        html += ' 📁'
      }
      
      html += '</div></td>'
      html += '</tr>'
    })
    
    html += '</tbody></table></div></div>'
    return html
  }
  
  /**
   * Gets the full path of an item including parent folders
   */
  private getItemPath(item: any): string {
    return item.path || item.name || 'Unnamed'
  }
  
  /**
   * Gets a summary of what changed in an item
   */
  private getChangeTypes(oldItem: any, newItem: any): string[] {
    const changes: string[] = []
    
    if (oldItem.url !== newItem.url) changes.push('URL')
    if (oldItem.method !== newItem.method) changes.push('Method')
    if (JSON.stringify(oldItem.headers) !== JSON.stringify(newItem.headers)) changes.push('Headers')
    if (oldItem.body !== newItem.body) changes.push('Body')
    if (oldItem.prerequest !== newItem.prerequest) changes.push('Pre-request')
    if (oldItem.tests !== newItem.tests) changes.push('Tests')
    
    return changes
  }
  
  /**
   * Generates detailed line-by-line changes for modified items
   */
  private generateDetailedChanges(oldItem: any, newItem: any): string {
    let html = '<table class="d2h-diff-table"><tbody class="d2h-diff-tbody">'
    
    // URL changes
    if (oldItem.url !== newItem.url) {
      html += this.createDiffRow('URL', oldItem.url, newItem.url)
    }
    
    // Method changes
    if (oldItem.method !== newItem.method) {
      html += this.createDiffRow('Method', oldItem.method, newItem.method)
    }
    
    // Headers changes
    if (JSON.stringify(oldItem.headers) !== JSON.stringify(newItem.headers)) {
      html += this.createHeadersDiff(oldItem.headers, newItem.headers)
    }
    
    // Body changes
    if (oldItem.body !== newItem.body) {
      html += this.createBodyDiff(oldItem.body, newItem.body)
    }
    
    // Pre-request script changes
    if (oldItem.prerequest !== newItem.prerequest) {
      html += this.createScriptDiff('Pre-request Script', oldItem.prerequest, newItem.prerequest)
    }
    
    // Test script changes
    if (oldItem.tests !== newItem.tests) {
      html += this.createScriptDiff('Test Script', oldItem.tests, newItem.tests)
    }
    
    html += '</tbody></table>'
    return html
  }
  
  /**
   * Creates a diff row for simple field changes
   */
  private createDiffRow(field: string, oldValue: any, newValue: any): string {
    let html = ''
    
    if (oldValue && newValue) {
      // Modified
      html += '<tr>'
      html += '<td class="d2h-code-linenumber d2h-del">-</td>'
      html += `<td class="d2h-del"><div class="d2h-code-line">- ${field}: ${oldValue}</div></td>`
      html += '</tr>'
      html += '<tr>'
      html += '<td class="d2h-code-linenumber d2h-ins">+</td>'
      html += `<td class="d2h-ins"><div class="d2h-code-line">+ ${field}: ${newValue}</div></td>`
      html += '</tr>'
    } else if (oldValue) {
      // Removed
      html += '<tr>'
      html += '<td class="d2h-code-linenumber d2h-del">-</td>'
      html += `<td class="d2h-del"><div class="d2h-code-line">- ${field}: ${oldValue}</div></td>`
      html += '</tr>'
    } else if (newValue) {
      // Added
      html += '<tr>'
      html += '<td class="d2h-code-linenumber d2h-ins">+</td>'
      html += `<td class="d2h-ins"><div class="d2h-code-line">+ ${field}: ${newValue}</div></td>`
      html += '</tr>'
    }
    
    return html
  }
  
  /**
   * Creates diff for headers
   */
  private createHeadersDiff(oldHeaders: any, newHeaders: any): string {
    let html = ''
    const oldHeadersObj = oldHeaders || {}
    const newHeadersObj = newHeaders || {}
    
    const allKeys = new Set([...Object.keys(oldHeadersObj), ...Object.keys(newHeadersObj)])
    
    allKeys.forEach(key => {
      if (oldHeadersObj[key] !== newHeadersObj[key]) {
        html += this.createDiffRow(`Header[${key}]`, oldHeadersObj[key], newHeadersObj[key])
      }
    })
    
    return html
  }
  
  /**
   * Creates diff for request body
   */
  private createBodyDiff(oldBody: string, newBody: string): string {
    if (!oldBody && !newBody) return ''
    
    let html = '<tr><td colspan="2" style="background: #f8f8f8; padding: 4px; font-weight: bold;">Request Body:</td></tr>'
    
    // Try to parse as JSON for better formatting
    let oldFormatted = oldBody
    let newFormatted = newBody
    
    try {
      if (oldBody) oldFormatted = JSON.stringify(JSON.parse(oldBody), null, 2)
    } catch {}
    
    try {
      if (newBody) newFormatted = JSON.stringify(JSON.parse(newBody), null, 2)
    } catch {}
    
    // Use proper diff algorithm
    const changes = diffLines(oldFormatted || '', newFormatted || '')
    
    html += this.renderDiffWithContext(changes, 3)
    
    return html
  }
  
  /**
   * Creates diff for scripts (pre-request or test)
   */
  private createScriptDiff(scriptType: string, oldScript: string | string[], newScript: string | string[]): string {
    if (!oldScript && !newScript) return ''
    
    let html = `<tr><td colspan="2" style="background: #f8f8f8; padding: 4px; font-weight: bold;">${scriptType}:</td></tr>`
    
    // Convert to string if array
    const oldScriptStr = Array.isArray(oldScript) ? oldScript.join('\n') : (oldScript || '')
    const newScriptStr = Array.isArray(newScript) ? newScript.join('\n') : (newScript || '')
    
    // Use proper diff algorithm
    const changes = diffLines(oldScriptStr, newScriptStr)
    
    html += this.renderDiffWithContext(changes, 3)
    
    return html
  }
  
  /**
   * Renders diff with collapsible context and line numbers
   */
  private renderDiffWithContext(changes: Change[], contextLines: number = 3): string {
    let html = ''
    let oldLineNum = 1
    let newLineNum = 1
    
    changes.forEach((change) => {
      if (!change.added && !change.removed) {
        // Unchanged lines - handle context
        const lines = change.value.split('\n').filter(l => l !== '')
        
        if (lines.length > contextLines * 2) {
          // Show first few lines of context
          for (let i = 0; i < contextLines; i++) {
            if (lines[i]) {
              html += '<tr>'
              html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">${oldLineNum++}</td>`
              html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">${newLineNum++}</td>`
              html += `<td><div class="d2h-code-line">${this.highlightCode(lines[i])}</div></td>`
              html += '</tr>'
            }
          }
          
          // Add collapse indicator
          const hiddenCount = lines.length - (contextLines * 2)
          if (hiddenCount > 0) {
            html += '<tr class="d2h-context-control">'
            html += '<td class="d2h-code-linenumber" style="text-align: center;">...</td>'
            html += '<td class="d2h-code-linenumber" style="text-align: center;">...</td>'
            html += `<td><div class="d2h-code-line" style="color: #999; cursor: pointer;" onclick="this.parentElement.parentElement.classList.toggle('expanded')">`
            html += `↕ ${hiddenCount} unchanged lines hidden (click to expand)`
            html += '</div></td>'
            html += '</tr>'
            
            // Hidden lines (shown when expanded)
            html += '<tr class="d2h-context-hidden" style="display: none;">'
            html += '<td colspan="3"><div style="max-height: 200px; overflow-y: auto;">'
            for (let i = contextLines; i < lines.length - contextLines; i++) {
              if (lines[i]) {
                html += `<div class="d2h-code-line"><span style="color: #999; margin-right: 10px;">${oldLineNum++}</span>${this.highlightCode(lines[i])}</div>`
                newLineNum++
              }
            }
            html += '</div></td></tr>'
          }
          
          // Show last few lines of context
          for (let i = Math.max(0, lines.length - contextLines); i < lines.length; i++) {
            if (lines[i]) {
              html += '<tr>'
              html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">${oldLineNum++}</td>`
              html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">${newLineNum++}</td>`
              html += `<td><div class="d2h-code-line">${this.highlightCode(lines[i])}</div></td>`
              html += '</tr>'
            }
          }
        } else {
          // Show all lines if there are few
          lines.forEach(line => {
            if (line) {
              html += '<tr>'
              html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">${oldLineNum++}</td>`
              html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">${newLineNum++}</td>`
              html += `<td><div class="d2h-code-line">${this.highlightCode(line)}</div></td>`
              html += '</tr>'
            }
          })
        }
      } else if (change.removed) {
        // Removed lines
        const lines = change.value.split('\n').filter(l => l !== '')
        lines.forEach(line => {
          html += '<tr class="d2h-del">'
          html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right;">${oldLineNum++}</td>`
          html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">-</td>`
          html += `<td><div class="d2h-code-line">${this.highlightCode(line)}</div></td>`
          html += '</tr>'
        })
      } else if (change.added) {
        // Added lines
        const lines = change.value.split('\n').filter(l => l !== '')
        lines.forEach(line => {
          html += '<tr class="d2h-ins">'
          html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right; color: #999;">-</td>`
          html += `<td class="d2h-code-linenumber" style="width: 40px; text-align: right;">${newLineNum++}</td>`
          html += `<td><div class="d2h-code-line">${this.highlightCode(line)}</div></td>`
          html += '</tr>'
        })
      }
    })
    
    return html
  }
  
  /**
   * Highlights code with syntax highlighting
   */
  private highlightCode(code: string): string {
    // For now, just escape HTML to avoid showing style strings
    // Proper syntax highlighting would require a more robust solution
    return this.escapeHtml(code)
  }
  
  /**
   * Escapes HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
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
