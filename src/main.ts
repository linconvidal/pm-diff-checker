import './style.css'
import { 
  FileInputComponent, 
  DiffViewerComponent, 
  TreeViewComponent,
  ExportControlsComponent 
} from './ui'
import { PostmanDiffer, PostmanNormalizer } from './core'
import type { PostmanCollection, DiffResult, DiffOptions, NormalizedCollection } from './types'

// Application state interface
interface AppState {
  oldCollection: PostmanCollection | null
  newCollection: PostmanCollection | null
  normalizedOld: NormalizedCollection | null
  normalizedNew: NormalizedCollection | null
  diffResult: DiffResult | null
  diffOptions: DiffOptions
  isProcessing: boolean
  error: string | null
}

/**
 * Main application orchestrator that manages the complete diff workflow
 */
class PostmanDiffApp {
  private state: AppState = {} as AppState
  private components: {
    oldFileInput: FileInputComponent
    newFileInput: FileInputComponent
    diffViewer: DiffViewerComponent
    treeView: TreeViewComponent
    exportControls: ExportControlsComponent
  } = {} as any
  private differ: PostmanDiffer = {} as any

  constructor() {
    this.initializeState()
    this.initializeComponents()
    this.setupEventHandlers()
    
    console.log('Postman Diff App initialized')
  }

  /**
   * Initialize application state
   */
  private initializeState(): void {
    this.state = {
      oldCollection: null,
      newCollection: null,
      normalizedOld: null,
      normalizedNew: null,
      diffResult: null,
      diffOptions: {
        ignoreOrder: false,
        ignoreWhitespace: true,
        normalizeJson: true,
        sortKeys: true
      },
      isProcessing: false,
      error: null
    }
  }

  /**
   * Initialize all UI components
   */
  private initializeComponents(): void {
    try {
      // Create file input container
      this.createFileInputContainer()

      // Initialize components
      this.components = {
        oldFileInput: new FileInputComponent('old-file-input', 'Old Collection'),
        newFileInput: new FileInputComponent('new-file-input', 'New Collection'),
        diffViewer: new DiffViewerComponent('diff-container'),
        treeView: new TreeViewComponent('tree-view-container', {
          onNodeSelect: (node) => this.handleNodeSelection(node),
          onNodeToggle: (node) => this.handleNodeToggle(node)
        }),
        exportControls: new ExportControlsComponent('export-controls-container', {
          onExport: (format, data) => this.handleExport(format, data),
          onImportFromPr: async (oldCollection, newCollection) => {
            try {
              this.setProcessing(true)
              this.clearError()
              if (oldCollection) {
                this.state.oldCollection = oldCollection
                this.state.normalizedOld = PostmanNormalizer.normalize(oldCollection)
              } else {
                this.state.oldCollection = null
                this.state.normalizedOld = null
              }
              if (newCollection) {
                this.state.newCollection = newCollection
                this.state.normalizedNew = PostmanNormalizer.normalize(newCollection)
              } else {
                this.state.newCollection = null
                this.state.normalizedNew = null
              }
              await this.tryGenerateDiff()
            } finally {
              this.setProcessing(false)
            }
          }
        })
      }

      // Initialize differ
      this.differ = new PostmanDiffer()

      console.log('All components initialized successfully')
    } catch (error) {
      this.handleError('Failed to initialize components: ' + (error as Error).message)
    }
  }

  /**
   * Create file input container in the top bar
   */
  private createFileInputContainer(): void {
    const fileInputsContainer = document.getElementById('file-inputs-container')
    if (fileInputsContainer) {
      fileInputsContainer.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 lg:min-w-[500px]">
          <div id="old-file-input"></div>
          <div id="new-file-input"></div>
        </div>
      `
    }
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // File input handlers
    this.components.oldFileInput.onLoad((collection) => {
      this.handleFileLoad('old', collection)
    })

    this.components.newFileInput.onLoad((collection) => {
      this.handleFileLoad('new', collection)
    })

    // No comparison options UI; keep defaults in state
  }

  /**
   * Handle file loading
   */
  private async handleFileLoad(type: 'old' | 'new', collection: PostmanCollection): Promise<void> {
    try {
      this.setProcessing(true)
      this.clearError()

      // Store collection
      if (type === 'old') {
        this.state.oldCollection = collection
      } else {
        this.state.newCollection = collection
      }

      // Normalize collection
      const normalized = PostmanNormalizer.normalize(collection)
      if (type === 'old') {
        this.state.normalizedOld = normalized
      } else {
        this.state.normalizedNew = normalized
      }

      // Update tree view
      this.components.treeView.loadCollection(normalized, type)

      // Try to generate diff if both collections are loaded
      await this.tryGenerateDiff()

    } catch (error) {
      this.handleError(`Failed to load ${type} collection: ` + (error as Error).message)
    } finally {
      this.setProcessing(false)
    }
  }

  // Comparison options UI removed; defaults remain in state

  /**
   * Handle tree node selection
   */
  private handleNodeSelection(node: any): void {
    console.log('Node selected:', node)
    // TODO: Filter diff viewer to show only selected node
    // This would require enhancing the diff viewer to support filtering
  }

  /**
   * Handle tree node toggle
   */
  private handleNodeToggle(node: any): void {
    console.log('Node toggled:', node)
    // Tree view handles the toggle internally
  }

  /**
   * Handle export requests
   */
  private handleExport(format: 'markdown' | 'json', data: any): void {
    console.log(`Exporting as ${format}:`, data)
    // Export controls handle the actual export
  }

  /**
   * Try to generate diff if both collections are available
   */
  private async tryGenerateDiff(): Promise<void> {
    if (!this.state.oldCollection || !this.state.newCollection) {
      return
    }

    try {
      this.setProcessing(true)
      this.clearError()

      // Generate diff
      const diffResult = this.differ.diff(
        this.state.oldCollection,
        this.state.newCollection
      )

      this.state.diffResult = diffResult

      // Update UI components
      this.components.diffViewer.showDiff(diffResult)
      
      // Update tree view with diff information
      if (this.state.normalizedOld && this.state.normalizedNew) {
        this.components.treeView.updateWithDiff(
          this.state.normalizedOld,
          this.state.normalizedNew
        )
      }

      // Update export controls with data
      this.components.exportControls.updateData({
        oldCollection: this.state.normalizedOld || undefined,
        newCollection: this.state.normalizedNew || undefined,
        diffResult: diffResult,
        options: this.state.diffOptions
      })

      console.log('Diff generated successfully')

    } catch (error) {
      this.handleError('Failed to generate diff: ' + (error as Error).message)
    } finally {
      this.setProcessing(false)
    }
  }

  /**
   * Set processing state and update UI
   */
  private setProcessing(processing: boolean): void {
    this.state.isProcessing = processing
    
    const loadingIndicator = document.getElementById('loading-indicator')
    if (loadingIndicator) {
      if (processing) {
        loadingIndicator.classList.remove('hidden')
      } else {
        loadingIndicator.classList.add('hidden')
      }
    }

    // Disable/enable components during processing
    this.components.exportControls.setEnabled(!processing)
  }

  /**
   * Handle errors and display to user
   */
  private handleError(message: string): void {
    this.state.error = message
    console.error('App Error:', message)
    
    // Show error in UI
    this.showErrorMessage(message)
  }

  /**
   * Clear error state
   */
  private clearError(): void {
    this.state.error = null
    this.hideErrorMessage()
  }

  /**
   * Show error message in UI
   */
  private showErrorMessage(message: string): void {
    // Create or update error message element
    let errorElement = document.getElementById('error-message')
    if (!errorElement) {
      errorElement = document.createElement('div')
      errorElement.id = 'error-message'
      errorElement.className = 'error-message'
      
      const rightPanel = document.querySelector('.right-panel .panel-content')
      if (rightPanel) {
        rightPanel.insertBefore(errorElement, rightPanel.firstChild)
      }
    }
    
    errorElement.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${message}</span>
        <button class="error-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
      </div>
    `
    errorElement.style.display = 'block'
  }

  /**
   * Hide error message
   */
  private hideErrorMessage(): void {
    const errorElement = document.getElementById('error-message')
    if (errorElement) {
      errorElement.style.display = 'none'
    }
  }

  /**
   * Get current application state (useful for debugging)
   */
  public getState(): AppState {
    return { ...this.state }
  }

  /**
   * Reset application state
   */
  public reset(): void {
    this.initializeState()
    this.components.diffViewer.clear()
    this.components.treeView.clear()
    this.components.exportControls.updateData({})
    this.clearError()
    this.setProcessing(false)
  }
}

// Initialize the app when DOM is loaded
const app = new PostmanDiffApp()

// Expose app to window for debugging
declare global {
  interface Window {
    postmanDiffApp: PostmanDiffApp
  }
}
window.postmanDiffApp = app
