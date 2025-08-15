import type { NormalizedCollection, NormalizedItem } from '../types'

export interface TreeNode {
  id: string
  name: string
  type: 'collection' | 'folder' | 'request'
  method?: string
  children?: TreeNode[]
  expanded?: boolean
  selected?: boolean
  changeType?: 'added' | 'removed' | 'modified' | 'unchanged'
}

export interface TreeViewOptions {
  showChangeIndicators?: boolean
  expandAll?: boolean
  onNodeSelect?: (node: TreeNode) => void
  onNodeToggle?: (node: TreeNode) => void
}

export class TreeViewComponent {
  private element: HTMLElement
  private options: TreeViewOptions
  private tree: TreeNode[] = []
  private selectedNode: TreeNode | null = null

  constructor(containerId: string, options: TreeViewOptions = {}) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.options = {
      showChangeIndicators: true,
      expandAll: false,
      ...options,
    }

    this.element = this.createElement()
    container.appendChild(this.element)
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden transition-colors duration-300'

    wrapper.innerHTML = `
      <div class="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex justify-between items-center transition-colors duration-300">
        <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Collection Structure</h3>
        <div class="flex gap-2">
          <button class="tree-control-btn px-2 py-1 text-xs bg-transparent border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-200" data-action="expand-all" title="Expand All">
            <span class="icon">⊞</span>
          </button>
          <button class="tree-control-btn px-2 py-1 text-xs bg-transparent border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-200" data-action="collapse-all" title="Collapse All">
            <span class="icon">⊟</span>
          </button>
        </div>
      </div>
      <div class="max-h-96 overflow-y-auto p-2">
        <div class="tree-placeholder text-center text-zinc-500 dark:text-zinc-400 py-8 italic">
          Load collections to see structure
        </div>
      </div>
    `

    this.setupEventListeners(wrapper)
    return wrapper
  }

  private setupEventListeners(wrapper: HTMLElement): void {
    // Control buttons
    wrapper.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('.tree-control-btn') as HTMLElement
      
      if (button) {
        const action = button.dataset.action
        if (action === 'expand-all') {
          this.expandAll()
        } else if (action === 'collapse-all') {
          this.collapseAll()
        }
      }

      // Node interactions
      const nodeElement = target.closest('.tree-node') as HTMLElement
      if (nodeElement) {
        const nodeId = nodeElement.dataset.nodeId
        const node = this.findNodeById(nodeId!)
        
        if (node) {
          if (target.classList.contains('tree-toggle')) {
            this.toggleNode(node)
          } else {
            this.selectNode(node)
          }
        }
      }
    })
  }

  /**
   * Loads collection data into the tree view
   */
  loadCollection(collection: NormalizedCollection, changeType: 'old' | 'new' | 'diff' = 'diff'): void {
    this.tree = this.buildTree(collection, changeType)
    this.render()
  }

  /**
   * Updates tree with diff information
   */
  updateWithDiff(oldCollection: NormalizedCollection, newCollection: NormalizedCollection): void {
    const oldTree = this.buildTree(oldCollection, 'old')
    const newTree = this.buildTree(newCollection, 'new')
    
    this.tree = this.mergeTrees(oldTree, newTree)
    this.render()
  }

  private buildTree(collection: NormalizedCollection, context: 'old' | 'new' | 'diff'): TreeNode[] {
    const rootNode: TreeNode = {
      id: 'collection-' + collection.info.name.replace(/[^a-zA-Z0-9]/g, '-'),
      name: collection.info.name,
      type: 'collection',
      expanded: true,
      children: this.buildItemNodes(collection.items, context),
      changeType: context === 'diff' ? 'unchanged' : undefined
    }

    return [rootNode]
  }

  private buildItemNodes(items: NormalizedItem[], context: 'old' | 'new' | 'diff'): TreeNode[] {
    return items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.children ? 'folder' : 'request',
      method: item.method,
      expanded: this.options.expandAll,
      children: item.children ? this.buildItemNodes(item.children, context) : undefined,
      changeType: context === 'diff' ? 'unchanged' : undefined
    }))
  }

  private mergeTrees(oldTree: TreeNode[], newTree: TreeNode[]): TreeNode[] {
    // Simplified merge - in a real implementation, this would be more sophisticated
    const merged: TreeNode[] = []
    const seenIds = new Set<string>()

    // Add all nodes from new tree (added/modified)
    newTree.forEach(node => {
      merged.push({
        ...node,
        changeType: 'added' // Simplified - would need proper diff logic
      })
      seenIds.add(node.id)
    })

    // Add nodes only in old tree (removed)
    oldTree.forEach(node => {
      if (!seenIds.has(node.id)) {
        merged.push({
          ...node,
          changeType: 'removed'
        })
      }
    })

    return merged
  }

  private render(): void {
    const contentElement = this.element.querySelector('.max-h-96') as HTMLElement
    
    if (this.tree.length === 0) {
      contentElement.innerHTML = '<div class="tree-placeholder text-center text-zinc-500 dark:text-zinc-400 py-8 italic">Load collections to see structure</div>'
      return
    }

    contentElement.innerHTML = this.renderNodes(this.tree)
  }

  private renderNodes(nodes: TreeNode[], level: number = 0): string {
    return nodes.map(node => this.renderNode(node, level)).join('')
  }

  private renderNode(node: TreeNode, level: number): string {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = node.expanded
    const selectedClass = node.selected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
    const indent = level * 16

    let icon = ''
    if (node.type === 'collection') {
      icon = '📁'
    } else if (node.type === 'folder') {
      icon = '📂'
    } else if (node.type === 'request') {
      const methodClass = node.method ? `method-badge ${node.method.toLowerCase()}` : 'method-badge get'
      icon = `<span class="${methodClass}">${node.method || 'GET'}</span>`
    }

    let toggleButton = ''
    if (hasChildren) {
      const toggleIcon = isExpanded ? '▼' : '▶'
      toggleButton = `<button class="tree-toggle w-4 h-4 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mr-2 text-xs transition-colors duration-200">${toggleIcon}</button>`
    }

    let changeIndicator = ''
    if (this.options.showChangeIndicators && node.changeType) {
      const indicators: Record<string, string> = {
        added: '+',
        removed: '-',
        modified: '~',
        unchanged: ''
      }
      if (indicators[node.changeType]) {
        changeIndicator = `<span class="change-indicator change-${node.changeType}">${indicators[node.changeType]}</span>`
      }
    }

    let childrenHtml = ''
    if (hasChildren && isExpanded) {
      childrenHtml = `<div class="border-l border-zinc-200 dark:border-zinc-700 ml-3">${this.renderNodes(node.children!, level + 1)}</div>`
    }

    return `
      <div class="my-0.5 rounded transition-colors duration-150 ${selectedClass}" data-node-id="${node.id}">
        <div class="flex items-center py-1 px-2 cursor-pointer min-h-[28px]" style="padding-left: ${indent + 8}px">
          ${toggleButton}
          <span class="mr-2 text-sm flex-shrink-0">${icon}</span>
          <span class="flex-1 text-zinc-900 dark:text-zinc-100 text-sm truncate">${node.name}</span>
          ${changeIndicator}
        </div>
        ${childrenHtml}
      </div>
    `
  }

  private findNodeById(id: string): TreeNode | null {
    const search = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node
        if (node.children) {
          const found = search(node.children)
          if (found) return found
        }
      }
      return null
    }
    return search(this.tree)
  }

  private toggleNode(node: TreeNode): void {
    node.expanded = !node.expanded
    this.render()
    this.options.onNodeToggle?.(node)
  }

  private selectNode(node: TreeNode): void {
    // Clear previous selection
    if (this.selectedNode) {
      this.selectedNode.selected = false
    }
    
    // Set new selection
    node.selected = true
    this.selectedNode = node
    
    this.render()
    this.options.onNodeSelect?.(node)
  }

  private expandAll(): void {
    const expandNodes = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        node.expanded = true
        if (node.children) {
          expandNodes(node.children)
        }
      })
    }
    expandNodes(this.tree)
    this.render()
  }

  private collapseAll(): void {
    const collapseNodes = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        node.expanded = false
        if (node.children) {
          collapseNodes(node.children)
        }
      })
    }
    collapseNodes(this.tree)
    this.render()
  }

  /**
   * Gets the currently selected node
   */
  getSelectedNode(): TreeNode | null {
    return this.selectedNode
  }

  /**
   * Clears the tree view
   */
  clear(): void {
    this.tree = []
    this.selectedNode = null
    this.render()
  }
}