import { html } from 'diff2html'
import type { TreeNode } from './tree'

export type ViewMode = 'side-by-side' | 'unified'
export type TabType = 'request' | 'pre-request' | 'tests' | 'body' | 'headers' | 'query'

export interface DiffData {
  oldContent: string
  newContent: string
  fileName?: string
  language?: string
}

export interface RequestDiffData {
  request?: DiffData
  preRequest?: DiffData
  tests?: DiffData
  body?: DiffData
  headers?: DiffData
  query?: DiffData
}

export interface RenderDiffEvents {
  onViewModeChange: (mode: ViewMode) => void
  onTabChange: (tab: TabType) => void
}

export class RenderDiffComponent {
  private element: HTMLElement
  private currentViewMode: ViewMode = 'side-by-side'
  private currentTab: TabType = 'request'
  private events: Partial<RenderDiffEvents> = {}
  private currentDiffData: RequestDiffData | null = null

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.element = this.createElement()
    container.appendChild(this.element)
    this.bindEvents()
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'w-full h-full flex flex-col'

    wrapper.innerHTML = `
      <div class="flex flex-col h-full">
        <!-- Header with controls -->
        <div class="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-6 py-4 flex justify-between items-center transition-colors duration-300">
          <div>
            <h3 id="diff-node-title" class="font-semibold text-zinc-900 dark:text-zinc-100">Diff Viewer</h3>
            <div id="diff-node-path" class="text-sm text-zinc-600 dark:text-zinc-400 mt-1"></div>
          </div>
          
          <div class="flex items-center gap-4">
            <div class="flex bg-zinc-200 dark:bg-zinc-700 rounded-lg p-1 transition-colors duration-300">
              <button class="view-mode-btn px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" data-mode="side-by-side" title="Side by Side">
                <svg viewBox="0 0 16 16" width="16" height="16" class="inline mr-1">
                  <rect x="1" y="2" width="6" height="12" fill="currentColor" opacity="0.3"/>
                  <rect x="9" y="2" width="6" height="12" fill="currentColor" opacity="0.3"/>
                </svg>
                Side by Side
              </button>
              <button class="view-mode-btn px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" data-mode="unified" title="Unified">
                <svg viewBox="0 0 16 16" width="16" height="16" class="inline mr-1">
                  <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.3"/>
                </svg>
                Unified
              </button>
            </div>

            <div class="flex gap-2">
              <button class="diff-action-btn p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-200" id="copy-diff-btn" title="Copy Diff">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" fill="currentColor"/>
                  <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" fill="currentColor"/>
                </svg>
              </button>
              
              <button class="diff-action-btn p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-200" id="expand-all-btn" title="Expand All">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <path d="M8.177.677l2.896 2.896a.25.25 0 01-.177.427H8.75v1.25a.75.75 0 01-1.5 0V4H5.104a.25.25 0 01-.177-.427L7.823.677a.25.25 0 01.354 0zM7.25 10.75a.75.75 0 011.5 0V12h2.146a.25.25 0 01.177.427l-2.896 2.896a.25.25 0 01-.354 0l-2.896-2.896A.25.25 0 015.104 12H7.25v-1.25z" fill="currentColor"/>
                </svg>
              </button>
              
              <button class="diff-action-btn p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-200" id="collapse-all-btn" title="Collapse All">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <path d="M7.823 1.677L4.927 4.573A.25.25 0 005.104 5H7.25v1.25a.75.75 0 001.5 0V5h2.146a.25.25 0 00.177-.427L8.177 1.677a.25.25 0 00-.354 0zM8.75 11.25a.75.75 0 00-1.5 0V12H5.104a.25.25 0 00-.177.427l2.896 2.896a.25.25 0 00.354 0l2.896-2.896A.25.25 0 0010.896 12H8.75v-.75z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Tab navigation for request parts -->
        <div class="hidden border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition-colors duration-300" id="tab-navigation">
          <div class="flex">
            <button class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" data-tab="request">
              <span class="mr-2">🔧</span>
              Request
            </button>
            <button class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors duration-200" data-tab="headers">
              <span class="mr-2">📝</span>
              Headers
            </button>
            <button class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors duration-200" data-tab="query">
              <span class="mr-2">❓</span>
              Query
            </button>
            <button class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors duration-200" data-tab="body">
              <span class="mr-2">📄</span>
              Body
            </button>
            <button class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors duration-200" data-tab="pre-request">
              <span class="mr-2">⚡</span>
              Pre-request
            </button>
            <button class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors duration-200" data-tab="tests">
              <span class="mr-2">✅</span>
              Tests
            </button>
          </div>
        </div>

        <!-- Diff content area -->
        <div class="flex-1 overflow-auto bg-white dark:bg-zinc-900 transition-colors duration-300" id="diff-content">
          <div class="flex flex-col items-center justify-center h-full text-center p-12">
            <div class="text-zinc-400 dark:text-zinc-500 mb-4">
              <svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor" opacity="0.3">
                <path d="M32 2L52 22v36H12V22L32 2z"/>
                <path d="M32 12v10h10"/>
                <path d="M20 32h24M20 40h24M20 48h16"/>
              </svg>
            </div>
            <h4 class="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">Select an item from the tree view</h4>
            <p class="text-zinc-600 dark:text-zinc-400">Choose a changed item to see detailed differences</p>
          </div>
        </div>

        <!-- Statistics bar -->
        <div class="hidden bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 px-6 py-3 flex gap-6 text-sm transition-colors duration-300" id="diff-stats">
          <div class="flex items-center gap-2">
            <span class="text-zinc-600 dark:text-zinc-400">Lines:</span>
            <span class="font-mono text-green-600 dark:text-green-400" id="lines-added">+0</span>
            <span class="font-mono text-red-600 dark:text-red-400" id="lines-removed">-0</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-zinc-600 dark:text-zinc-400">Characters:</span>
            <span class="font-mono text-zinc-900 dark:text-zinc-100" id="chars-changed">0</span>
          </div>
        </div>
      </div>
    `

    return wrapper
  }

  private bindEvents(): void {
    // View mode toggle
    const viewModeButtons = this.element.querySelectorAll('.view-mode-btn')
    viewModeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.getAttribute('data-mode') as ViewMode
        this.setViewMode(mode)
      })
    })

    // Tab navigation
    const tabButtons = this.element.querySelectorAll('.tab-btn')
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab') as TabType
        this.setActiveTab(tab)
      })
    })

    // Action buttons
    const copyBtn = this.element.querySelector('#copy-diff-btn') as HTMLButtonElement
    const expandAllBtn = this.element.querySelector('#expand-all-btn') as HTMLButtonElement
    const collapseAllBtn = this.element.querySelector('#collapse-all-btn') as HTMLButtonElement

    copyBtn.addEventListener('click', () => this.copyDiffToClipboard())
    expandAllBtn.addEventListener('click', () => this.expandAllSections())
    collapseAllBtn.addEventListener('click', () => this.collapseAllSections())
  }

  private setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode

    // Update button states
    const buttons = this.element.querySelectorAll('.view-mode-btn')
    buttons.forEach(btn => {
      const isActive = btn.getAttribute('data-mode') === mode
      if (isActive) {
        btn.classList.add('bg-white', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-zinc-100', 'shadow-sm')
        btn.classList.remove('text-zinc-600', 'dark:text-zinc-400')
      } else {
        btn.classList.remove('bg-white', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-zinc-100', 'shadow-sm')
        btn.classList.add('text-zinc-600', 'dark:text-zinc-400')
      }
    })

    // Re-render current diff with new mode
    if (this.currentDiffData) {
      this.renderCurrentTab()
    }

    this.events.onViewModeChange?.(mode)
  }

  private setActiveTab(tab: TabType): void {
    this.currentTab = tab

    // Update tab button states
    const buttons = this.element.querySelectorAll('.tab-btn')
    buttons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tab
      if (isActive) {
        btn.classList.add('border-blue-500', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20')
        btn.classList.remove('border-transparent', 'text-zinc-600', 'dark:text-zinc-400')
      } else {
        btn.classList.remove('border-blue-500', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20')
        btn.classList.add('border-transparent', 'text-zinc-600', 'dark:text-zinc-400')
      }
    })

    // Show content for the selected tab
    this.renderCurrentTab()

    this.events.onTabChange?.(tab)
  }

  private renderCurrentTab(): void {
    if (!this.currentDiffData) return

    const diffData = this.currentDiffData[this.currentTab as keyof RequestDiffData]
    if (!diffData) {
      this.showNoDataMessage(`No ${this.currentTab} data available for this item`)
      return
    }

    this.renderDiff(diffData)
  }

  private showNoDataMessage(message: string): void {
    const contentElement = this.element.querySelector('#diff-content') as HTMLElement
    contentElement.innerHTML = `
      <div class="diff-placeholder">
        <div class="placeholder-icon">
          <svg viewBox="0 0 16 16" width="32" height="32" fill="currentColor" opacity="0.3">
            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM8 7a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3A.5.5 0 0 0 8 7zM8 5.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/>
          </svg>
        </div>
        <p>${message}</p>
      </div>
    `
  }

  private renderDiff(diffData: DiffData): void {
    try {
      // Create unified diff format for diff2html
      const unifiedDiff = this.createUnifiedDiff(diffData)
      
      // Generate HTML using diff2html
      const diffHtml = html(unifiedDiff, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: this.currentViewMode === 'side-by-side' ? 'side-by-side' : 'line-by-line',
      })

      const contentElement = this.element.querySelector('#diff-content') as HTMLElement
      contentElement.innerHTML = diffHtml

      // Apply syntax highlighting for known languages
      if (diffData.language) {
        this.applySyntaxHighlighting(contentElement, diffData.language)
      }

      // Add custom enhancements
      this.enhanceDiffDisplay(contentElement)

      // Update statistics
      this.updateStatistics(diffData)

      // Show stats bar
      const statsElement = this.element.querySelector('#diff-stats') as HTMLElement
      statsElement.classList.remove('hidden')
      statsElement.classList.add('flex')

    } catch (error) {
      console.error('Error rendering diff:', error)
      this.showNoDataMessage('Error rendering diff content')
    }
  }

  private createUnifiedDiff(diffData: DiffData): string {
    const { oldContent, newContent, fileName = 'content' } = diffData
    
    // Simple unified diff format
    const header = `--- a/${fileName}\n+++ b/${fileName}\n`
    
    // For now, create a simple diff representation
    // In a full implementation, you would use a proper diff algorithm
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    
    let diff = header
    
    // This is a simplified diff generation
    // In practice, you'd use a proper diff algorithm like Myers
    const maxLines = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || ''
      const newLine = newLines[i] || ''
      
      if (oldLine === newLine) {
        diff += ` ${oldLine}\n`
      } else {
        if (oldLine) {
          diff += `-${oldLine}\n`
        }
        if (newLine) {
          diff += `+${newLine}\n`
        }
      }
    }
    
    return diff
  }

  private applySyntaxHighlighting(container: HTMLElement, language: string): void {
    // Basic syntax highlighting for common languages
    const codeElements = container.querySelectorAll('.d2h-code-line-ctn')
    
    codeElements.forEach(element => {
      const code = element.textContent || ''
      
      if (language === 'javascript' || language === 'js') {
        this.highlightJavaScript(element as HTMLElement, code)
      } else if (language === 'json') {
        this.highlightJSON(element as HTMLElement, code)
      }
    })
  }

  private highlightJavaScript(element: HTMLElement, code: string): void {
    // Basic JavaScript syntax highlighting
    const keywords = /\b(function|var|let|const|if|else|for|while|return|class|extends|import|export|from|async|await|try|catch|finally)\b/g
    const strings = /(["'`])((?:(?!\1)[^\\]|\\.)*)(\1)/g
    const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm
    
    let highlighted = code
    highlighted = highlighted.replace(keywords, '<span class="syntax-keyword">$1</span>')
    highlighted = highlighted.replace(strings, '<span class="syntax-string">$1$2$3</span>')
    highlighted = highlighted.replace(comments, '<span class="syntax-comment">$1</span>')
    
    element.innerHTML = highlighted
  }

  private highlightJSON(element: HTMLElement, code: string): void {
    // Basic JSON syntax highlighting
    const strings = /"((?:[^"\\]|\\.)*)"/g
    const numbers = /\b\d+\.?\d*\b/g
    const booleans = /\b(true|false|null)\b/g
    
    let highlighted = code
    highlighted = highlighted.replace(strings, '<span class="syntax-string">"$1"</span>')
    highlighted = highlighted.replace(numbers, '<span class="syntax-number">$1</span>')
    highlighted = highlighted.replace(booleans, '<span class="syntax-boolean">$1</span>')
    
    element.innerHTML = highlighted
  }

  private enhanceDiffDisplay(container: HTMLElement): void {
    // Add line numbers if not present
    this.addLineNumbers(container)
    
    // Add collapse/expand functionality
    this.addCollapseFeature(container)
    
    // Add copy line functionality
    this.addCopyLineFeature(container)
  }

  private addLineNumbers(container: HTMLElement): void {
    const lines = container.querySelectorAll('.d2h-code-line')
    lines.forEach((line, index) => {
      if (!line.querySelector('.line-number')) {
        const lineNumber = document.createElement('span')
        lineNumber.className = 'line-number'
        lineNumber.textContent = (index + 1).toString()
        line.insertBefore(lineNumber, line.firstChild)
      }
    })
  }

  private addCollapseFeature(container: HTMLElement): void {
    const sections = container.querySelectorAll('.d2h-file-wrapper')
    sections.forEach(section => {
      const header = section.querySelector('.d2h-file-header')
      if (header && !header.querySelector('.collapse-toggle')) {
        const toggleBtn = document.createElement('button')
        toggleBtn.className = 'collapse-toggle'
        toggleBtn.innerHTML = '−'
        toggleBtn.title = 'Collapse/Expand section'
        
        toggleBtn.addEventListener('click', () => {
          const content = section.querySelector('.d2h-file-diff') as HTMLElement
          if (content) {
            const isCollapsed = content.classList.contains('hidden')
            if (isCollapsed) {
              content.classList.remove('hidden')
            } else {
              content.classList.add('hidden')
            }
            toggleBtn.innerHTML = isCollapsed ? '−' : '+'
          }
        })
        
        header.appendChild(toggleBtn)
      }
    })
  }

  private addCopyLineFeature(container: HTMLElement): void {
    const lines = container.querySelectorAll('.d2h-code-line')
    lines.forEach(line => {
      line.addEventListener('dblclick', () => {
        const text = line.textContent || ''
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Line copied to clipboard')
        }).catch(() => {
          console.log('Failed to copy line to clipboard')
        })
      })
    })
  }

  private updateStatistics(diffData: DiffData): void {
    const oldLines = diffData.oldContent.split('\n')
    const newLines = diffData.newContent.split('\n')
    
    // Simple statistics calculation
    let linesAdded = 0
    let linesRemoved = 0
    let charsChanged = 0
    
    const maxLines = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || ''
      const newLine = newLines[i] || ''
      
      if (i >= oldLines.length) {
        linesAdded++
        charsChanged += newLine.length
      } else if (i >= newLines.length) {
        linesRemoved++
        charsChanged += oldLine.length
      } else if (oldLine !== newLine) {
        charsChanged += Math.abs(newLine.length - oldLine.length)
      }
    }
    
    const linesAddedElement = this.element.querySelector('#lines-added') as HTMLElement
    const linesRemovedElement = this.element.querySelector('#lines-removed') as HTMLElement
    const charsChangedElement = this.element.querySelector('#chars-changed') as HTMLElement
    
    linesAddedElement.textContent = `+${linesAdded}`
    linesRemovedElement.textContent = `-${linesRemoved}`
    charsChangedElement.textContent = charsChanged.toString()
  }

  private async copyDiffToClipboard(): Promise<void> {
    const contentElement = this.element.querySelector('#diff-content') as HTMLElement
    const text = contentElement.textContent || ''
    
    try {
      await navigator.clipboard.writeText(text)
      this.showToast('Diff copied to clipboard')
    } catch {
      console.log('Failed to copy diff to clipboard')
    }
  }

  private expandAllSections(): void {
    const sections = this.element.querySelectorAll('.d2h-file-diff')
    const toggles = this.element.querySelectorAll('.collapse-toggle')
    
    sections.forEach(section => {
      (section as HTMLElement).classList.remove('hidden')
    })
    
    toggles.forEach(toggle => {
      (toggle as HTMLElement).innerHTML = '−'
    })
  }

  private collapseAllSections(): void {
    const sections = this.element.querySelectorAll('.d2h-file-diff')
    const toggles = this.element.querySelectorAll('.collapse-toggle')
    
    sections.forEach(section => {
      (section as HTMLElement).classList.add('hidden')
    })
    
    toggles.forEach(toggle => {
      (toggle as HTMLElement).innerHTML = '+'
    })
  }

  private showToast(message: string): void {
    // Simple toast notification
    const toast = document.createElement('div')
    toast.className = 'toast-notification'
    toast.textContent = message
    
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.classList.add('show')
    }, 100)
    
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => {
        document.body.removeChild(toast)
      }, 300)
    }, 2000)
  }

  // Public API methods
  showNodeDiff(node: TreeNode, diffData: RequestDiffData): void {
    this.currentDiffData = diffData
    
    // Update title and path
    const titleElement = this.element.querySelector('#diff-node-title') as HTMLElement
    const pathElement = this.element.querySelector('#diff-node-path') as HTMLElement
    
    titleElement.textContent = node.name
    pathElement.textContent = node.path
    
    // Show tab navigation for requests
    const tabNavigation = this.element.querySelector('#tab-navigation') as HTMLElement
    if (node.type === 'request') {
      tabNavigation.classList.remove('hidden')
      
      // Update tab availability based on available data
      const tabButtons = this.element.querySelectorAll('.tab-btn')
      tabButtons.forEach(btn => {
        const tab = btn.getAttribute('data-tab') as keyof RequestDiffData
        const hasData = diffData[tab] !== undefined
        if (!hasData) {
          btn.classList.add('disabled')
        } else {
          btn.classList.remove('disabled')
        }
        (btn as HTMLButtonElement).disabled = !hasData
      })
      
      // Select first available tab
      const availableTabs = Object.keys(diffData) as TabType[]
      if (availableTabs.length > 0) {
        this.setActiveTab(availableTabs[0])
      }
    } else {
      tabNavigation.classList.add('hidden')
      // For folders, show summary
      this.showFolderSummary(node)
    }
  }

  private showFolderSummary(node: TreeNode): void {
    const contentElement = this.element.querySelector('#diff-content') as HTMLElement
    
    // Count changes in children
    const stats = this.countChildrenChanges(node)
    
    contentElement.innerHTML = `
      <div class="folder-summary">
        <div class="summary-header">
          <div class="folder-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
            </svg>
          </div>
          <h4>${node.name}</h4>
          <p class="folder-path">${node.path}</p>
        </div>
        
        <div class="summary-stats">
          <div class="stat-card">
            <span class="stat-number">${stats.totalChanges}</span>
            <span class="stat-label">Total Changes</span>
          </div>
          <div class="stat-card added">
            <span class="stat-number">${stats.added}</span>
            <span class="stat-label">Added</span>
          </div>
          <div class="stat-card removed">
            <span class="stat-number">${stats.removed}</span>
            <span class="stat-label">Removed</span>
          </div>
          <div class="stat-card modified">
            <span class="stat-number">${stats.modified}</span>
            <span class="stat-label">Modified</span>
          </div>
        </div>
        
        ${this.generateChildrenList(node)}
      </div>
    `

    // Hide stats bar for folder view
    const statsElement = this.element.querySelector('#diff-stats') as HTMLElement
    statsElement.classList.add('hidden')
    statsElement.classList.remove('flex')
  }

  private countChildrenChanges(node: TreeNode): any {
    let stats = { totalChanges: 0, added: 0, removed: 0, modified: 0, moved: 0, renamed: 0 }
    
    const countRecursive = (n: TreeNode) => {
      if (n.changeType !== 'unchanged') {
        stats.totalChanges++
        switch (n.changeType) {
          case 'added': stats.added++; break
          case 'removed': stats.removed++; break
          case 'modified': stats.modified++; break
          case 'moved': stats.moved++; break
          case 'renamed': stats.renamed++; break
        }
      }
      
      if (n.children) {
        n.children.forEach(countRecursive)
      }
    }
    
    if (node.children) {
      node.children.forEach(countRecursive)
    }
    
    return stats
  }

  private generateChildrenList(node: TreeNode): string {
    if (!node.children || node.children.length === 0) {
      return '<div class="no-children">No items in this folder</div>'
    }
    
    const changedChildren = node.children.filter(child => child.changeType !== 'unchanged')
    
    if (changedChildren.length === 0) {
      return '<div class="no-changes">No changes in this folder</div>'
    }
    
    const childrenHtml = changedChildren.map(child => `
      <div class="child-item ${child.changeType}">
        <span class="child-icon">${child.type === 'folder' ? '📁' : '📄'}</span>
        <span class="child-name">${child.name}</span>
        <span class="child-status">${this.getStatusBadge(child.changeType)}</span>
      </div>
    `).join('')
    
    return `
      <div class="children-list">
        <h5>Changed Items (${changedChildren.length})</h5>
        <div class="children-items">
          ${childrenHtml}
        </div>
      </div>
    `
  }

  private getStatusBadge(changeType: string): string {
    const badges = {
      added: '<span class="status-badge added">+</span>',
      removed: '<span class="status-badge removed">-</span>',
      moved: '<span class="status-badge moved">→</span>',
      renamed: '<span class="status-badge renamed">↻</span>',
      modified: '<span class="status-badge modified">~</span>',
    }
    
    return badges[changeType as keyof typeof badges] || ''
  }

  on<K extends keyof RenderDiffEvents>(event: K, callback: RenderDiffEvents[K]): void {
    this.events[event] = callback
  }

  clear(): void {
    this.currentDiffData = null
    
    const contentElement = this.element.querySelector('#diff-content') as HTMLElement
    contentElement.innerHTML = `
      <div class="diff-placeholder">
        <div class="placeholder-icon">
          <svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor" opacity="0.3">
            <path d="M32 2L52 22v36H12V22L32 2z"/>
            <path d="M32 12v10h10"/>
            <path d="M20 32h24M20 40h24M20 48h16"/>
          </svg>
        </div>
        <h4>Select an item from the tree view</h4>
        <p>Choose a changed item to see detailed differences</p>
      </div>
    `
    
    const tabNavigation = this.element.querySelector('#tab-navigation') as HTMLElement
    tabNavigation.classList.add('hidden')
    
    const statsElement = this.element.querySelector('#diff-stats') as HTMLElement
    statsElement.classList.add('hidden')
    statsElement.classList.remove('flex')
    
    const titleElement = this.element.querySelector('#diff-node-title') as HTMLElement
    const pathElement = this.element.querySelector('#diff-node-path') as HTMLElement
    
    titleElement.textContent = 'Diff Viewer'
    pathElement.textContent = ''
  }
}