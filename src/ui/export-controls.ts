import type { DiffResult, NormalizedCollection } from '../types'

export interface ExportData {
  oldCollection?: NormalizedCollection
  newCollection?: NormalizedCollection
  diffResult?: DiffResult
  options?: any
}

export interface ExportControlsOptions {
  onExport?: (format: 'markdown' | 'json', data: ExportData) => void
}

export class ExportControlsComponent {
  private element: HTMLElement
  private currentData: ExportData = {}
  private onExport?: (format: 'markdown' | 'json', data: ExportData) => void

  constructor(containerId: string, options: ExportControlsOptions = {}) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.onExport = options.onExport
    this.element = this.createElement()
    container.appendChild(this.element)
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden min-w-[200px] transition-colors duration-300'

    wrapper.innerHTML = `
      <div class="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 transition-colors duration-300">
        <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Export Results</h3>
      </div>
      <div class="p-4">
        <div class="flex flex-col gap-2 mb-4">
          <button class="export-btn flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed" data-format="markdown" title="Export as Markdown Report">
            <span class="text-base">📄</span>
            <span class="font-medium">Markdown Report</span>
          </button>
          <button class="export-btn flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed" data-format="json" title="Export as JSON Data">
            <span class="text-base">📋</span>
            <span class="font-medium">JSON Data</span>
          </button>
        </div>
        <div class="export-status info text-zinc-600 dark:text-zinc-400 text-xs">
          Ready to export when diff is available
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
        const format = button.dataset.format as 'markdown' | 'json'
        if (format) {
          this.handleExport(format)
        }
      }
    })
  }

  private handleExport(format: 'markdown' | 'json'): void {
    if (!this.currentData.diffResult) {
      this.showStatus('No diff data available to export', 'error')
      return
    }

    this.showStatus('Preparing export...', 'loading')
    
    try {
      this.onExport?.(format, this.currentData)
      
      if (format === 'markdown') {
        this.exportMarkdown()
      } else if (format === 'json') {
        this.exportJson()
      }
      
      this.showStatus('Export completed successfully', 'success')
    } catch (error) {
      this.showStatus('Export failed: ' + (error as Error).message, 'error')
    }
  }

  private exportMarkdown(): void {
    const markdown = this.generateMarkdownReport()
    this.downloadFile(markdown, 'postman-diff-report.md', 'text/markdown')
  }

  private exportJson(): void {
    const jsonData = JSON.stringify(this.currentData, null, 2)
    this.downloadFile(jsonData, 'postman-diff-data.json', 'application/json')
  }

  private generateMarkdownReport(): string {
    const { diffResult, oldCollection, newCollection } = this.currentData
    
    if (!diffResult) {
      return '# Postman Collection Diff Report\n\nNo diff data available.'
    }

    const oldName = oldCollection?.info.name || 'Old Collection'
    const newName = newCollection?.info.name || 'New Collection'
    const timestamp = new Date().toISOString()

    let markdown = `# Postman Collection Diff Report

**Generated:** ${timestamp}
**Comparing:** ${oldName} → ${newName}

## Summary

`

    // Add statistics if available
    if (diffResult.patches) {
      const stats = this.calculateStats(diffResult.patches)
      markdown += `
- **Added:** ${stats.added} items
- **Removed:** ${stats.removed} items  
- **Modified:** ${stats.modified} items

`
    }

    markdown += `## Detailed Changes

\`\`\`diff
${diffResult.oldCollection}
---
${diffResult.newCollection}
\`\`\`

## Change Patches

`

    if (diffResult.patches) {
      diffResult.patches.forEach((patch, index) => {
        const changeType = patch.added ? 'Added' : patch.removed ? 'Removed' : 'Modified'
        markdown += `### Change ${index + 1}: ${changeType}

\`\`\`
${patch.value}
\`\`\`

`
      })
    }

    markdown += `
---
*Report generated by Postman Collection Diff Viewer*
`

    return markdown
  }

  private calculateStats(patches: any[]): { added: number, removed: number, modified: number } {
    let added = 0, removed = 0, modified = 0
    
    patches.forEach(patch => {
      if (patch.added) added++
      else if (patch.removed) removed++
      else modified++
    })
    
    return { added, removed, modified }
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

  private showStatus(message: string, type: 'loading' | 'success' | 'error' | 'info' = 'info'): void {
    const statusElement = this.element.querySelector('.export-status') as HTMLElement
    if (statusElement) {
      statusElement.textContent = message
      statusElement.className = `export-status ${type}`
      
      if (type === 'success' || type === 'error') {
        setTimeout(() => {
          statusElement.textContent = 'Ready to export when diff is available'
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
      this.showStatus('Ready to export', 'success')
    } else {
      this.showStatus('Ready to export when diff is available', 'info')
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