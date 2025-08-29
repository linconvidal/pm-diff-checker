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

    // Show statistics with navigation
    const stats = this.calculateStats(diffResult)
    statsElement.innerHTML = `
      <a href="#added-section" class="stat added" style="text-decoration: none; cursor: pointer;">+${stats.added} added</a>
      <a href="#removed-section" class="stat removed" style="text-decoration: none; cursor: pointer;">-${stats.removed} removed</a>
      <a href="#modified-section" class="stat modified" style="text-decoration: none; cursor: pointer;">~${stats.modified} modified</a>
    `

    // Show diff HTML
    contentElement.innerHTML = diffResult.htmlDiff

    // Add syntax highlighting and styling
    this.enhanceDiffDisplay(contentElement)
    
    // Add smooth scrolling for navigation
    statsElement.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const target = document.querySelector(link.getAttribute('href')!)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    })
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
