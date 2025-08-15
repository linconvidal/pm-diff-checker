import type { DiffResult } from '../types'

export class DiffViewerComponent {
  private element: HTMLElement

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.element = this.createElement()
    container.appendChild(this.element)
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'diff-viewer'

    wrapper.innerHTML = `
      <div class="diff-header">
        <h2>Collection Diff</h2>
        <div class="diff-stats"></div>
      </div>
      <div class="diff-content">
        <div class="diff-placeholder">
          Select two Postman collections to see the differences
        </div>
      </div>
    `

    return wrapper
  }

  showDiff(diffResult: DiffResult): void {
    const contentElement = this.element.querySelector('.diff-content') as HTMLElement
    const statsElement = this.element.querySelector('.diff-stats') as HTMLElement

    // Show statistics
    const stats = this.calculateStats(diffResult)
    statsElement.innerHTML = `
      <span class="stat added">+${stats.added} added</span>
      <span class="stat removed">-${stats.removed} removed</span>
      <span class="stat modified">~${stats.modified} modified</span>
    `

    // Show diff HTML
    contentElement.innerHTML = diffResult.htmlDiff

    // Add syntax highlighting and styling
    this.enhanceDiffDisplay(contentElement)
  }

  private calculateStats(diffResult: DiffResult): {
    added: number
    removed: number
    modified: number
  } {
    const stats = { added: 0, removed: 0, modified: 0 }

    diffResult.patches.forEach(patch => {
      if (patch.added) {
        stats.added++
      } else if (patch.removed) {
        stats.removed++
      } else if (patch.value.trim()) {
        stats.modified++
      }
    })

    return stats
  }

  private enhanceDiffDisplay(container: HTMLElement): void {
    // Add line numbers if not already present
    const codeBlocks = container.querySelectorAll('code')
    codeBlocks.forEach(block => {
      if (!block.classList.contains('enhanced')) {
        block.classList.add('enhanced')
        this.addLineNumbers(block)
      }
    })

    // Add collapse/expand functionality for large diffs
    this.addCollapseFeature(container)
  }

  private addLineNumbers(codeBlock: HTMLElement): void {
    const lines = codeBlock.innerHTML.split('\n')
    const numberedLines = lines.map(
      (line, index) => `<span class="line-number">${index + 1}</span>${line}`
    )
    codeBlock.innerHTML = numberedLines.join('\n')
  }

  private addCollapseFeature(container: HTMLElement): void {
    const sections = container.querySelectorAll('.d2h-file-wrapper')
    sections.forEach(section => {
      const header = section.querySelector('.d2h-file-header')
      if (header) {
        header.addEventListener('click', () => {
          const content = section.querySelector('.d2h-file-diff')
          if (content) {
            content.classList.toggle('collapsed')
          }
        })
      }
    })
  }

  clear(): void {
    const contentElement = this.element.querySelector('.diff-content') as HTMLElement
    const statsElement = this.element.querySelector('.diff-stats') as HTMLElement

    contentElement.innerHTML =
      '<div class="diff-placeholder">Select two Postman collections to see the differences</div>'
    statsElement.innerHTML = ''
  }
}
