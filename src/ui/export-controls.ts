import type { DiffResult, NormalizedCollection } from '../types'
import type { PostmanCollection } from '../types/postman'

export interface ExportData {
  oldCollection?: NormalizedCollection
  newCollection?: NormalizedCollection
  diffResult?: DiffResult
  options?: any
}

export interface ExportControlsOptions {
  onExport?: (format: 'markdown', data: ExportData) => void
  onImportFromPr?: (oldCollection: PostmanCollection | null, newCollection: PostmanCollection | null, meta?: any) => void
}

export class ExportControlsComponent {
  private element: HTMLElement
  private currentData: ExportData = {}
  private onExport?: (format: 'markdown', data: ExportData) => void
  private onImportFromPr?: (oldCollection: PostmanCollection | null, newCollection: PostmanCollection | null, meta?: any) => void

  constructor(containerId: string, options: ExportControlsOptions = {}) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.onExport = options.onExport
    this.onImportFromPr = options.onImportFromPr
    this.element = this.createElement()
    container.appendChild(this.element)
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 min-w-[200px]'

    wrapper.innerHTML = `
      <div>
        <h3 class="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-3">Export</h3>
        <div class="flex flex-col gap-2 mb-3">
          <button class="export-btn flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed" data-format="markdown" title="Export as Markdown Report">
            <span class="font-mono text-xs">MD</span>
            <span>Markdown</span>
          </button>
          <button class="pr-fetch-btn flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm" title="Fetch collections from a GitHub PR">
            <span class="font-mono text-xs">PR</span>
            <span>Fetch from PR</span>
          </button>
        </div>
        <div class="export-status info text-xs">
        </div>
      </div>
    `

    this.setupEventListeners(wrapper)
    return wrapper
  }

  private setupEventListeners(wrapper: HTMLElement): void {
    wrapper.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('.export-btn') as HTMLElement
      
      if (button) {
        const format = button.dataset.format as 'markdown'
        if (format) {
          this.handleExport(format)
        }
      }

      const prBtn = target.closest('.pr-fetch-btn') as HTMLElement
      if (prBtn) {
        this.openPrModal()
      }
    })
  }

  private handleExport(format: 'markdown'): void {
    if (!this.currentData.diffResult) {
      this.showStatus('No diff data available to export', 'error')
      return
    }

    this.showStatus('Preparing export...', 'loading')
    
    try {
      this.onExport?.(format, this.currentData)
      
      this.exportMarkdown()
      
      this.showStatus('Export completed successfully', 'success')
    } catch (error) {
      this.showStatus('Export failed: ' + (error as Error).message, 'error')
    }
  }

  private exportMarkdown(): void {
    const markdown = this.generateMarkdownReport()
    this.downloadFile(markdown, 'postman-diff-report.md', 'text/markdown')
  }

  /* JSON export removed as unnecessary */

  private generateMarkdownReport(): string {
    const { oldCollection, newCollection } = this.currentData
    
    if (!oldCollection || !newCollection) {
      return '# Postman Collection Diff Report\n\nPlease load both collections to generate a report.'
    }

    const oldName = oldCollection?.info.name || 'Old Collection'
    const newName = newCollection?.info.name || 'New Collection'
    const timestamp = new Date().toISOString()

    let markdown = `# Postman Collection Diff Report

**Generated:** ${timestamp}
**Comparing:** ${oldName} → ${newName}

## Summary

`

    // Compare collections structurally
    const changes = this.compareCollections(oldCollection, newCollection)
    
    markdown += `
- **Added:** ${changes.added.length} items
- **Removed:** ${changes.removed.length} items  
- **Modified:** ${changes.modified.length} items

`

    // Show added items
    if (changes.added.length > 0) {
      markdown += `## ✅ Added Items\n\n`
      changes.added.forEach(item => {
        const isFolder = !!item.children && item.children.length > 0
        const icon = isFolder ? '📁 ' : ''
        markdown += `- ${icon}**${item.name}**`
        if (item.method && item.url) {
          markdown += ` - \`${item.method} ${item.url}\``
        }
        markdown += '\n'
      })
      markdown += '\n'
    }

    // Show removed items
    if (changes.removed.length > 0) {
      markdown += `## ❌ Removed Items\n\n`
      changes.removed.forEach(item => {
        const isFolder = !!item.children && item.children.length > 0
        const icon = isFolder ? '📁 ' : ''
        markdown += `- ${icon}**${item.name}**`
        if (item.method && item.url) {
          markdown += ` - \`${item.method} ${item.url}\``
        }
        markdown += '\n'
      })
      markdown += '\n'
    }

    // Show modified items
    if (changes.modified.length > 0) {
      markdown += `## 🔄 Modified Items\n\n`
      changes.modified.forEach(item => {
        const isFolder = !!item.children && item.children.length > 0
        const icon = isFolder ? '📁 ' : ''
        markdown += `- ${icon}**${item.name}**`
        if (item.method && item.url) {
          markdown += ` - \`${item.method} ${item.url}\``
        }
        if (item.changes && item.changes.length > 0) {
          markdown += '\n  Changes:\n'
          item.changes.forEach((change: string) => {
            markdown += `  - ${change}\n`
          })
        }
        markdown += '\n'
      })
      markdown += '\n'
    }


    markdown += `
---
*Report generated by Postman Collection Diff Viewer*
`

    return markdown
  }

  private compareCollections(oldCollection: any, newCollection: any): {
    added: any[],
    removed: any[],
    modified: any[]
  } {
    const added: any[] = []
    const removed: any[] = []
    const modified: any[] = []

    if (!oldCollection || !newCollection) {
      return { added, removed, modified }
    }

    const oldItems = this.flattenItems(oldCollection.items || [])
    const newItems = this.flattenItems(newCollection.items || [])

    // Create maps for easier comparison
    const oldMap = new Map(oldItems.map(item => [item.id, item]))
    const newMap = new Map(newItems.map(item => [item.id, item]))

    // Find removed items
    oldMap.forEach((item, id) => {
      if (!newMap.has(id)) {
        removed.push(item)
      }
    })

    // Find added and modified items
    newMap.forEach((item, id) => {
      if (!oldMap.has(id)) {
        added.push(item)
      } else {
        const oldItem = oldMap.get(id)
        const changes = this.getItemChanges(oldItem, item)
        if (changes.length > 0) {
          modified.push({ ...item, changes })
        }
      }
    })

    return { added, removed, modified }
  }

  private flattenItems(items: any[], result: any[] = []): any[] {
    items.forEach(item => {
      result.push(item)
      if (item.children) {
        this.flattenItems(item.children, result)
      }
    })
    return result
  }

  private getItemChanges(oldItem: any, newItem: any): string[] {
    const changes: string[] = []

    if (oldItem.method !== newItem.method) {
      changes.push(`Method changed from ${oldItem.method} to ${newItem.method}`)
    }
    if (oldItem.url !== newItem.url) {
      changes.push(`URL changed from "${oldItem.url}" to "${newItem.url}"`)
    }
    if (JSON.stringify(oldItem.headers) !== JSON.stringify(newItem.headers)) {
      changes.push('Headers modified')
    }
    if (oldItem.body !== newItem.body) {
      changes.push('Body modified')
    }
    if (JSON.stringify(oldItem.tests) !== JSON.stringify(newItem.tests)) {
      changes.push('Tests modified')
    }

    return changes
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  // --- GitHub PR Import ---
  private openPrModal(): void {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 bg-white/80 dark:bg-zinc-950/80 flex items-center justify-center z-[1000]'

    const modal = document.createElement('div')
    modal.className = 'bg-white dark:bg-zinc-950 w-[95vw] max-w-xl p-6 border border-zinc-200 dark:border-zinc-800'
    modal.innerHTML = `
      <h3 class="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-4">GitHub PR Import</h3>
      <div class="space-y-4">
        <input id="pr-url" type="url" placeholder="https://github.com/owner/repo/pull/123" class="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-600"/>
        <div class="flex gap-2">
          <button id="load-pr" class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30">Load</button>
          <button id="cancel-pr" class="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</button>
        </div>
        <div id="pr-status" class="text-xs text-zinc-600 dark:text-zinc-400"></div>
        <div id="pr-files" class="max-h-60 overflow-auto space-y-2"></div>
      </div>
    `

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const close = () => document.body.removeChild(overlay)
    modal.querySelector('#cancel-pr')!.addEventListener('click', close)

    const loadBtn = modal.querySelector('#load-pr') as HTMLButtonElement
    const urlInput = modal.querySelector('#pr-url') as HTMLInputElement
    const statusEl = modal.querySelector('#pr-status') as HTMLElement
    const filesEl = modal.querySelector('#pr-files') as HTMLElement

    const parsePrUrl = (url: string) => {
      const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/(pull|pulls)\/([0-9]+)/)
      if (!m) return null
      return { owner: m[1], repo: m[2], number: m[4] }
    }

    const fetchJson = async (u: string) => {
      const headers: any = { Accept: 'application/vnd.github+json' }
      const r = await fetch(u, { headers })
      if (!r.ok) throw new Error(`GitHub API ${r.status}`)
      return r.json()
    }

    const fetchRaw = async (u: string) => {
      const headers: any = { Accept: 'application/vnd.github.v3.raw' }
      const r = await fetch(u, { headers })
      if (!r.ok) throw new Error(`GitHub raw ${r.status}`)
      return r.text()
    }

    const looksLikePm21 = (obj: any) => !!obj?.info?.schema?.includes('collection/v2.1')

    loadBtn.addEventListener('click', async () => {
      const info = parsePrUrl(urlInput.value.trim())
      if (!info) {
        statusEl.textContent = 'Invalid PR URL'
        return
      }
      filesEl.innerHTML = ''
      statusEl.textContent = 'Loading PR files…'
      loadBtn.disabled = true
      try {
        const pr = await fetchJson(`https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.number}`)

        // Fetch all PR files across pages
        let page = 1
        let files: any[] = []
        while (true) {
          const pageItems = await fetchJson(`https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.number}/files?per_page=100&page=${page}`)
          if (!Array.isArray(pageItems) || pageItems.length === 0) break
          files = files.concat(pageItems)
          if (pageItems.length < 100) break
          page++
          if (page > 10) break // safety cap
        }
        const baseSha = pr?.base?.sha
        const headSha = pr?.head?.sha
        const jsonFiles = (files || []).filter((f: any) => typeof f.filename === 'string' && f.filename.endsWith('.json'))

        const candidates: Array<{ path: string; oldCol: PostmanCollection | null; newCol: PostmanCollection | null } > = []
        for (const f of jsonFiles) {
          try {
            const path = encodeURIComponent(f.filename).replace(/%2F/g, '/')
            // head/new
            let newCol: PostmanCollection | null = null
            try {
              const newText = await fetchRaw(`https://api.github.com/repos/${info.owner}/${info.repo}/contents/${path}?ref=${headSha}`)
              const parsed = JSON.parse(newText)
              if (looksLikePm21(parsed)) newCol = parsed
            } catch {}

            // base/old
            let oldCol: PostmanCollection | null = null
            try {
              const oldText = await fetchRaw(`https://api.github.com/repos/${info.owner}/${info.repo}/contents/${path}?ref=${baseSha}`)
              const parsed = JSON.parse(oldText)
              if (looksLikePm21(parsed)) oldCol = parsed
            } catch {}

            if (newCol || oldCol) {
              candidates.push({ path: f.filename, oldCol, newCol })
            }
          } catch {}
        }

        if (candidates.length === 0) {
          statusEl.textContent = 'No Postman v2.1 collections found in PR'
        } else {
          statusEl.textContent = 'Select a collection to load'
          filesEl.innerHTML = candidates.map((c, idx) => {
            const oldName = c.oldCol?.info?.name || '—'
            const newName = c.newCol?.info?.name || '—'
            return `<div class="flex items-center justify-between gap-2 p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">`+
                   `<div class="text-sm"><div class="font-medium text-zinc-900 dark:text-zinc-100">${c.path}</div>`+
                   `<div class="text-xs text-zinc-500 dark:text-zinc-400">Old: ${oldName} · New: ${newName}</div></div>`+
                   `<button data-idx="${idx}" class="select-pr px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700">Select</button>`+
                   `</div>`
          }).join('')

          filesEl.querySelectorAll('.select-pr').forEach(btn => {
            btn.addEventListener('click', () => {
              const i = Number((btn as HTMLElement).getAttribute('data-idx'))
              const chosen = candidates[i]
              this.onImportFromPr?.(chosen.oldCol, chosen.newCol, { path: chosen.path, prNumber: info.number, repo: `${info.owner}/${info.repo}` })
              close()
            })
          })
        }
      } catch (e) {
        statusEl.textContent = `Failed to load PR: ${(e as Error).message}`
      } finally {
        loadBtn.disabled = false
      }
    })
  }

  private showStatus(message: string, type: 'loading' | 'success' | 'error' | 'info' = 'info'): void {
    const statusElement = this.element.querySelector('.export-status') as HTMLElement
    if (statusElement) {
      statusElement.textContent = message
      statusElement.className = `export-status ${type}`
      
      if (type === 'success' || type === 'error') {
        setTimeout(() => {
          statusElement.textContent = ''
          statusElement.className = 'export-status'
        }, 3000)
      }
    }
  }

  /**
   * Updates the export data
   */
  updateData(data: Partial<ExportData>): void {
    this.currentData = { ...this.currentData, ...data }
    this.updateButtonStates()
  }


  private updateButtonStates(): void {
    const buttons = this.element.querySelectorAll('.export-btn') as NodeListOf<HTMLButtonElement>
    const hasData = !!this.currentData.diffResult
    
    buttons.forEach(button => {
      button.disabled = !hasData
    })

    if (hasData) {
      this.showStatus('', 'success')
    } else {
      this.showStatus('', 'info')
    }
  }

  /**
   * Enables or disables export controls
   */
  setEnabled(enabled: boolean): void {
    const buttons = this.element.querySelectorAll('.export-btn') as NodeListOf<HTMLButtonElement>
    
    buttons.forEach(button => {
      button.disabled = !enabled || !this.currentData.diffResult
    })

    if (enabled) {
      this.element.classList.remove('opacity-50', 'pointer-events-none')
    } else {
      this.element.classList.add('opacity-50', 'pointer-events-none')
    }
  }
}
