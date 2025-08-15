import type { PostmanCollection } from '../types'

export interface DiffConfiguration {
  ignoreIds: boolean
  sortItems: boolean
  prettierScripts: boolean
  prettyJson: boolean
  hideWhitespace: boolean
}

export interface ControlsEvents {
  onRunDiff: (oldCollection: PostmanCollection, newCollection: PostmanCollection, config: DiffConfiguration) => void
  onLoadFromGitHub: (url: string) => void
  onExportMarkdown: () => void
  onExportNormalizedJson: (type: 'old' | 'new') => void
}

export class ControlsComponent {
  private element: HTMLElement
  private oldCollection: PostmanCollection | null = null
  private newCollection: PostmanCollection | null = null
  private events: Partial<ControlsEvents> = {}

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
    wrapper.className = 'controls-wrapper'

    wrapper.innerHTML = `
      <div class="controls-container">
        <!-- File Inputs Section -->
        <div class="file-inputs-section">
          <div class="file-input-group">
            <label class="file-input-label">Old Collection</label>
            <div class="file-input-container">
              <input type="file" id="old-file-input" accept=".json" class="file-input" />
              <label for="old-file-input" class="file-input-button">Choose File</label>
              <span class="file-status" data-target="old">No file selected</span>
            </div>
          </div>
          
          <div class="file-input-group">
            <label class="file-input-label">New Collection</label>
            <div class="file-input-container">
              <input type="file" id="new-file-input" accept=".json" class="file-input" />
              <label for="new-file-input" class="file-input-button">Choose File</label>
              <span class="file-status" data-target="new">No file selected</span>
            </div>
          </div>

          <div class="github-section">
            <button class="github-button" id="github-load-btn">
              <svg class="github-icon" viewBox="0 0 16 16" width="16" height="16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Load from GitHub
            </button>
            <div class="github-input-container" id="github-input-container" style="display: none;">
              <input type="url" id="github-url" placeholder="https://github.com/user/repo/raw/main/collection.json" class="github-url-input" />
              <button id="github-load-submit" class="github-submit-btn">Load</button>
              <button id="github-cancel" class="github-cancel-btn">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Configuration Toggles -->
        <div class="config-section">
          <h3 class="config-title">Configuration</h3>
          <div class="config-toggles">
            <label class="toggle-container">
              <input type="checkbox" id="ignore-ids" checked />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Ignore IDs/timestamps</span>
            </label>

            <label class="toggle-container">
              <input type="checkbox" id="sort-items" checked />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Sort items</span>
            </label>

            <label class="toggle-container">
              <input type="checkbox" id="prettier-scripts" checked />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Prettier scripts</span>
            </label>

            <label class="toggle-container">
              <input type="checkbox" id="pretty-json" checked />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Pretty JSON bodies</span>
            </label>

            <label class="toggle-container">
              <input type="checkbox" id="hide-whitespace" checked />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Hide whitespace-only changes</span>
            </label>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="actions-section">
          <button id="run-diff-btn" class="run-diff-button" disabled>
            <svg class="diff-icon" viewBox="0 0 16 16" width="16" height="16">
              <path d="M8.75 0c0 .414-.336.75-.75.75H6.5c-.414 0-.75.336-.75.75s.336.75.75.75h1.5c1.243 0 2.25 1.007 2.25 2.25v1.5c0 .414.336.75.75.75s.75-.336.75-.75v-1.5C11.75 2.007 10.493.75 8.25.75H8C7.586.75 7.25.414 7.25 0s.336-.75.75-.75h.75z"/>
              <path d="M2.75 6.25c-.414 0-.75.336-.75.75v3.5c0 1.243 1.007 2.25 2.25 2.25h5.5c1.243 0 2.25-1.007 2.25-2.25V7c0-.414-.336-.75-.75-.75s-.75.336-.75.75v3.5c0 .414-.336.75-.75.75h-5.5c-.414 0-.75-.336-.75-.75V7c0-.414-.336-.75-.75-.75z"/>
            </svg>
            Run Diff
          </button>

          <div class="export-section">
            <button id="export-markdown-btn" class="export-button" disabled>
              Export Markdown Summary
            </button>
            
            <div class="export-json-group">
              <button id="export-old-json-btn" class="export-button secondary" disabled>
                Export Normalized JSON (Old)
              </button>
              <button id="export-new-json-btn" class="export-button secondary" disabled>
                Export Normalized JSON (New)
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    return wrapper
  }

  private bindEvents(): void {
    // File input handlers
    const oldFileInput = this.element.querySelector('#old-file-input') as HTMLInputElement
    const newFileInput = this.element.querySelector('#new-file-input') as HTMLInputElement

    oldFileInput.addEventListener('change', (e) => this.handleFileInput(e, 'old'))
    newFileInput.addEventListener('change', (e) => this.handleFileInput(e, 'new'))

    // GitHub load handlers
    const githubBtn = this.element.querySelector('#github-load-btn') as HTMLButtonElement
    const githubContainer = this.element.querySelector('#github-input-container') as HTMLElement
    const githubSubmit = this.element.querySelector('#github-load-submit') as HTMLButtonElement
    const githubCancel = this.element.querySelector('#github-cancel') as HTMLButtonElement
    const githubUrl = this.element.querySelector('#github-url') as HTMLInputElement

    githubBtn.addEventListener('click', () => {
      githubContainer.style.display = 'flex'
      githubUrl.focus()
    })

    githubCancel.addEventListener('click', () => {
      githubContainer.style.display = 'none'
      githubUrl.value = ''
    })

    githubSubmit.addEventListener('click', () => {
      const url = githubUrl.value.trim()
      if (url) {
        this.events.onLoadFromGitHub?.(url)
        githubContainer.style.display = 'none'
        githubUrl.value = ''
      }
    })

    githubUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        githubSubmit.click()
      }
    })

    // Run diff button
    const runDiffBtn = this.element.querySelector('#run-diff-btn') as HTMLButtonElement
    runDiffBtn.addEventListener('click', () => {
      if (this.oldCollection && this.newCollection) {
        const config = this.getConfiguration()
        this.events.onRunDiff?.(this.oldCollection, this.newCollection, config)
      }
    })

    // Export buttons
    const exportMarkdownBtn = this.element.querySelector('#export-markdown-btn') as HTMLButtonElement
    const exportOldJsonBtn = this.element.querySelector('#export-old-json-btn') as HTMLButtonElement
    const exportNewJsonBtn = this.element.querySelector('#export-new-json-btn') as HTMLButtonElement

    exportMarkdownBtn.addEventListener('click', () => this.events.onExportMarkdown?.())
    exportOldJsonBtn.addEventListener('click', () => this.events.onExportNormalizedJson?.('old'))
    exportNewJsonBtn.addEventListener('click', () => this.events.onExportNormalizedJson?.('new'))
  }

  private async handleFileInput(event: Event, type: 'old' | 'new'): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    const statusElement = this.element.querySelector(`[data-target="${type}"]`) as HTMLElement

    if (!file) {
      statusElement.textContent = 'No file selected'
      statusElement.className = 'file-status'
      if (type === 'old') {
        this.oldCollection = null
      } else {
        this.newCollection = null
      }
      this.updateButtonStates()
      return
    }

    statusElement.textContent = `Loading ${file.name}...`
    statusElement.className = 'file-status loading'

    try {
      const collection = await this.loadFile(file)
      
      if (type === 'old') {
        this.oldCollection = collection
      } else {
        this.newCollection = collection
      }

      statusElement.textContent = `✓ ${file.name}`
      statusElement.className = 'file-status success'
      
      this.updateButtonStates()
    } catch (error) {
      statusElement.textContent = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      statusElement.className = 'file-status error'
      
      if (type === 'old') {
        this.oldCollection = null
      } else {
        this.newCollection = null
      }
      this.updateButtonStates()
    }
  }

  private async loadFile(file: File): Promise<PostmanCollection> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          const collection = JSON.parse(content) as PostmanCollection

          // Basic validation
          if (!collection.info || !collection.info.name) {
            throw new Error('Invalid Postman collection format')
          }

          resolve(collection)
        } catch (error) {
          reject(new Error('Failed to parse JSON file'))
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      reader.readAsText(file)
    })
  }

  private updateButtonStates(): void {
    const runDiffBtn = this.element.querySelector('#run-diff-btn') as HTMLButtonElement
    const exportButtons = this.element.querySelectorAll('.export-button') as NodeListOf<HTMLButtonElement>

    const hasCollections = this.oldCollection && this.newCollection
    runDiffBtn.disabled = !hasCollections

    exportButtons.forEach(btn => {
      btn.disabled = !hasCollections
    })
  }

  private getConfiguration(): DiffConfiguration {
    return {
      ignoreIds: (this.element.querySelector('#ignore-ids') as HTMLInputElement).checked,
      sortItems: (this.element.querySelector('#sort-items') as HTMLInputElement).checked,
      prettierScripts: (this.element.querySelector('#prettier-scripts') as HTMLInputElement).checked,
      prettyJson: (this.element.querySelector('#pretty-json') as HTMLInputElement).checked,
      hideWhitespace: (this.element.querySelector('#hide-whitespace') as HTMLInputElement).checked,
    }
  }

  // Public API methods
  on<K extends keyof ControlsEvents>(event: K, callback: ControlsEvents[K]): void {
    this.events[event] = callback
  }

  setOldCollection(collection: PostmanCollection): void {
    this.oldCollection = collection
    const statusElement = this.element.querySelector('[data-target="old"]') as HTMLElement
    statusElement.textContent = `✓ ${collection.info.name}`
    statusElement.className = 'file-status success'
    this.updateButtonStates()
  }

  setNewCollection(collection: PostmanCollection): void {
    this.newCollection = collection
    const statusElement = this.element.querySelector('[data-target="new"]') as HTMLElement
    statusElement.textContent = `✓ ${collection.info.name}`
    statusElement.className = 'file-status success'
    this.updateButtonStates()
  }

  getOldCollection(): PostmanCollection | null {
    return this.oldCollection
  }

  getNewCollection(): PostmanCollection | null {
    return this.newCollection
  }

  getConfig(): DiffConfiguration {
    return this.getConfiguration()
  }

  setLoadingState(isLoading: boolean): void {
    const runDiffBtn = this.element.querySelector('#run-diff-btn') as HTMLButtonElement
    
    if (isLoading) {
      runDiffBtn.disabled = true
      runDiffBtn.innerHTML = `
        <div class="loading-spinner"></div>
        Processing...
      `
    } else {
      runDiffBtn.disabled = !(this.oldCollection && this.newCollection)
      runDiffBtn.innerHTML = `
        <svg class="diff-icon" viewBox="0 0 16 16" width="16" height="16">
          <path d="M8.75 0c0 .414-.336.75-.75.75H6.5c-.414 0-.75.336-.75.75s.336.75.75.75h1.5c1.243 0 2.25 1.007 2.25 2.25v1.5c0 .414.336.75.75.75s.75-.336.75-.75v-1.5C11.75 2.007 10.493.75 8.25.75H8C7.586.75 7.25.414 7.25 0s.336-.75.75-.75h.75z"/>
          <path d="M2.75 6.25c-.414 0-.75.336-.75.75v3.5c0 1.243 1.007 2.25 2.25 2.25h5.5c1.243 0 2.25-1.007 2.25-2.25V7c0-.414-.336-.75-.75-.75s-.75.336-.75.75v3.5c0 .414-.336.75-.75.75h-5.5c-.414 0-.75-.336-.75-.75V7c0-.414-.336-.75-.75-.75z"/>
        </svg>
        Run Diff
      `
    }
  }
}