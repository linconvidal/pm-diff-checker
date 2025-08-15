export type ChangeType = 'added' | 'removed' | 'moved' | 'renamed' | 'modified' | 'unchanged'

export interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'request'
  path: string
  changeType: ChangeType
  children?: TreeNode[]
  method?: string
  oldPath?: string // for moved/renamed items
  details?: {
    method?: boolean
    url?: boolean
    headers?: boolean
    body?: boolean
    tests?: boolean
    preRequest?: boolean
  }
}

export interface TreeStats {
  added: number
  removed: number
  moved: number
  renamed: number
  modified: number
  total: number
}

export interface TreeEvents {
  onNodeSelect: (node: TreeNode) => void
  onFilterChange: (filters: Set<ChangeType>) => void
}

export class TreeComponent {
  private element: HTMLElement
  private nodes: TreeNode[] = []
  private selectedNode: TreeNode | null = null
  private activeFilters: Set<ChangeType> = new Set()
  private events: Partial<TreeEvents> = {}
  private expandedNodes: Set<string> = new Set()

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
    wrapper.className = 'tree-wrapper'

    wrapper.innerHTML = `
      <div class="tree-container">
        <!-- Header with stats and filters -->
        <div class="tree-header">
          <h3 class="tree-title">Changes Summary</h3>
          <div class="tree-stats" id="tree-stats">
            <!-- Stats will be populated dynamically -->
          </div>
        </div>

        <!-- Filter chips -->
        <div class="tree-filters" id="tree-filters">
          <div class="filter-chip" data-type="added">
            <span class="filter-badge added">+</span>
            <span class="filter-label">Added</span>
            <span class="filter-count">0</span>
          </div>
          <div class="filter-chip" data-type="removed">
            <span class="filter-badge removed">-</span>
            <span class="filter-label">Removed</span>
            <span class="filter-count">0</span>
          </div>
          <div class="filter-chip" data-type="moved">
            <span class="filter-badge moved">→</span>
            <span class="filter-label">Moved</span>
            <span class="filter-count">0</span>
          </div>
          <div class="filter-chip" data-type="renamed">
            <span class="filter-badge renamed">↻</span>
            <span class="filter-label">Renamed</span>
            <span class="filter-count">0</span>
          </div>
          <div class="filter-chip" data-type="modified">
            <span class="filter-badge modified">~</span>
            <span class="filter-label">Modified</span>
            <span class="filter-count">0</span>
          </div>
          <button class="filter-clear" id="clear-filters" style="display: none;">
            Clear Filters
          </button>
        </div>

        <!-- Tree view -->
        <div class="tree-view" id="tree-view">
          <div class="tree-placeholder">
            Run a diff to see the collection structure and changes
          </div>
        </div>
      </div>
    `

    return wrapper
  }

  private bindEvents(): void {
    // Filter chip click handlers
    const filterChips = this.element.querySelectorAll('.filter-chip')
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-type') as ChangeType
        this.toggleFilter(type)
      })
    })

    // Clear filters button
    const clearFiltersBtn = this.element.querySelector('#clear-filters') as HTMLButtonElement
    clearFiltersBtn.addEventListener('click', () => {
      this.clearFilters()
    })
  }

  private toggleFilter(type: ChangeType): void {
    const chip = this.element.querySelector(`[data-type="${type}"]`) as HTMLElement
    
    if (this.activeFilters.has(type)) {
      this.activeFilters.delete(type)
      chip.classList.remove('active')
    } else {
      this.activeFilters.add(type)
      chip.classList.add('active')
    }

    this.updateClearButtonVisibility()
    this.renderTree()
    this.events.onFilterChange?.(this.activeFilters)
  }

  private clearFilters(): void {
    this.activeFilters.clear()
    const activeChips = this.element.querySelectorAll('.filter-chip.active')
    activeChips.forEach(chip => chip.classList.remove('active'))
    this.updateClearButtonVisibility()
    this.renderTree()
    this.events.onFilterChange?.(this.activeFilters)
  }

  private updateClearButtonVisibility(): void {
    const clearBtn = this.element.querySelector('#clear-filters') as HTMLElement
    clearBtn.style.display = this.activeFilters.size > 0 ? 'block' : 'none'
  }

  private calculateStats(nodes: TreeNode[]): TreeStats {
    const stats: TreeStats = {
      added: 0,
      removed: 0,
      moved: 0,
      renamed: 0,
      modified: 0,
      total: 0
    }

    const countNode = (node: TreeNode) => {
      if (node.changeType !== 'unchanged') {
        stats.total++
        switch (node.changeType) {
          case 'added':
            stats.added++
            break
          case 'removed':
            stats.removed++
            break
          case 'moved':
            stats.moved++
            break
          case 'renamed':
            stats.renamed++
            break
          case 'modified':
            stats.modified++
            break
        }
      }

      if (node.children) {
        node.children.forEach(countNode)
      }
    }

    nodes.forEach(countNode)
    return stats
  }

  private updateStats(stats: TreeStats): void {
    const statsContainer = this.element.querySelector('#tree-stats') as HTMLElement
    
    statsContainer.innerHTML = `
      <div class="stat-item">
        <span class="stat-value">${stats.total}</span>
        <span class="stat-label">Total Changes</span>
      </div>
      <div class="stat-breakdown">
        <span class="stat-detail added">+${stats.added}</span>
        <span class="stat-detail removed">-${stats.removed}</span>
        <span class="stat-detail moved">→${stats.moved}</span>
        <span class="stat-detail renamed">↻${stats.renamed}</span>
        <span class="stat-detail modified">~${stats.modified}</span>
      </div>
    `

    // Update filter chip counts
    const filterChips = this.element.querySelectorAll('.filter-chip')
    filterChips.forEach(chip => {
      const type = chip.getAttribute('data-type') as keyof TreeStats
      const countElement = chip.querySelector('.filter-count') as HTMLElement
      countElement.textContent = stats[type].toString()
    })
  }

  private shouldShowNode(node: TreeNode): boolean {
    // If no filters are active, show all nodes with changes
    if (this.activeFilters.size === 0) {
      return node.changeType !== 'unchanged' || this.hasChangedChildren(node)
    }

    // If filters are active, show only matching nodes
    if (this.activeFilters.has(node.changeType)) {
      return true
    }

    // Show parent folders if they have matching children
    return this.hasMatchingChildren(node)
  }

  private hasChangedChildren(node: TreeNode): boolean {
    if (!node.children) return false
    
    return node.children.some(child => 
      child.changeType !== 'unchanged' || this.hasChangedChildren(child)
    )
  }

  private hasMatchingChildren(node: TreeNode): boolean {
    if (!node.children) return false
    
    return node.children.some(child => 
      this.activeFilters.has(child.changeType) || this.hasMatchingChildren(child)
    )
  }

  private renderTree(): void {
    const treeView = this.element.querySelector('#tree-view') as HTMLElement
    
    if (this.nodes.length === 0) {
      treeView.innerHTML = '<div class="tree-placeholder">Run a diff to see the collection structure and changes</div>'
      return
    }

    const filteredNodes = this.nodes.filter(node => this.shouldShowNode(node))
    
    if (filteredNodes.length === 0) {
      treeView.innerHTML = '<div class="tree-placeholder">No items match the current filters</div>'
      return
    }

    treeView.innerHTML = ''
    const treeList = document.createElement('ul')
    treeList.className = 'tree-list'
    
    filteredNodes.forEach(node => {
      const nodeElement = this.createNodeElement(node, 0)
      treeList.appendChild(nodeElement)
    })

    treeView.appendChild(treeList)
  }

  private createNodeElement(node: TreeNode, depth: number): HTMLElement {
    const li = document.createElement('li')
    li.className = 'tree-node'
    li.setAttribute('data-node-id', node.id)

    const hasChildren = node.children && node.children.length > 0
    const isExpanded = this.expandedNodes.has(node.id)
    const isSelected = this.selectedNode?.id === node.id

    li.innerHTML = `
      <div class="tree-node-content ${isSelected ? 'selected' : ''}" data-depth="${depth}">
        ${hasChildren ? `
          <button class="tree-expand-btn ${isExpanded ? 'expanded' : ''}" data-node-id="${node.id}">
            <svg class="expand-icon" viewBox="0 0 16 16" width="12" height="12">
              <path d="M6 4l4 4-4 4" fill="currentColor"/>
            </svg>
          </button>
        ` : '<span class="tree-spacer"></span>'}
        
        <span class="tree-icon ${node.type}">
          ${this.getNodeIcon(node)}
        </span>
        
        <span class="tree-label" title="${node.path}">
          ${node.name}
          ${node.method ? `<span class="method-badge ${node.method.toLowerCase()}">${node.method}</span>` : ''}
        </span>
        
        <span class="tree-status">
          ${this.getStatusBadge(node)}
        </span>
        
        ${this.getChangeDetails(node)}
      </div>
    `

    // Add children if expanded
    if (hasChildren && isExpanded) {
      const childList = document.createElement('ul')
      childList.className = 'tree-children'
      
      node.children!
        .filter(child => this.shouldShowNode(child))
        .forEach(child => {
          const childElement = this.createNodeElement(child, depth + 1)
          childList.appendChild(childElement)
        })
      
      li.appendChild(childList)
    }

    // Bind events
    const content = li.querySelector('.tree-node-content') as HTMLElement
    const expandBtn = li.querySelector('.tree-expand-btn') as HTMLButtonElement

    content.addEventListener('click', (e) => {
      if (e.target === expandBtn) return
      this.selectNode(node)
    })

    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.toggleNodeExpansion(node.id)
      })
    }

    return li
  }

  private getNodeIcon(node: TreeNode): string {
    if (node.type === 'folder') {
      return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
        <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h2.879a2.5 2.5 0 0 1 1.768.732l1.06 1.06A1.5 1.5 0 0 0 11.268 4.5H13.5A2.5 2.5 0 0 1 16 7v5.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 12.5v-8A2.5 2.5 0 0 1 2.5 2H2v2.5z"/>
      </svg>`
    } else {
      return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
        <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm1 0v10h10V3H3z"/>
        <path d="M5 5h6v1H5V5zm0 2h6v1H5V7zm0 2h6v1H5V9z"/>
      </svg>`
    }
  }

  private getStatusBadge(node: TreeNode): string {
    const badges = {
      added: '<span class="status-badge added" title="Added">+</span>',
      removed: '<span class="status-badge removed" title="Removed">-</span>',
      moved: '<span class="status-badge moved" title="Moved">→</span>',
      renamed: '<span class="status-badge renamed" title="Renamed">↻</span>',
      modified: '<span class="status-badge modified" title="Modified">~</span>',
      unchanged: ''
    }
    
    return badges[node.changeType] || ''
  }

  private getChangeDetails(node: TreeNode): string {
    if (node.changeType === 'moved' && node.oldPath) {
      return `<div class="change-detail">from: ${node.oldPath}</div>`
    }
    
    if (node.changeType === 'modified' && node.details) {
      const modifiedParts = Object.entries(node.details)
        .filter(([_, changed]) => changed)
        .map(([part, _]) => part)
      
      if (modifiedParts.length > 0) {
        return `<div class="change-detail">changed: ${modifiedParts.join(', ')}</div>`
      }
    }
    
    return ''
  }

  private selectNode(node: TreeNode): void {
    // Update visual selection
    const previousSelected = this.element.querySelector('.tree-node-content.selected')
    if (previousSelected) {
      previousSelected.classList.remove('selected')
    }

    const nodeElement = this.element.querySelector(`[data-node-id="${node.id}"] .tree-node-content`)
    if (nodeElement) {
      nodeElement.classList.add('selected')
    }

    this.selectedNode = node
    this.events.onNodeSelect?.(node)
  }

  private toggleNodeExpansion(nodeId: string): void {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId)
    } else {
      this.expandedNodes.add(nodeId)
    }
    
    this.renderTree()
  }

  // Public API methods
  setNodes(nodes: TreeNode[]): void {
    this.nodes = nodes
    this.selectedNode = null
    
    // Calculate and update stats
    const stats = this.calculateStats(nodes)
    this.updateStats(stats)
    
    // Auto-expand nodes with changes
    this.autoExpandChanged(nodes)
    
    this.renderTree()
  }

  private autoExpandChanged(nodes: TreeNode[]): void {
    const expandNode = (node: TreeNode) => {
      if (node.children && this.hasChangedChildren(node)) {
        this.expandedNodes.add(node.id)
        node.children.forEach(expandNode)
      }
    }

    nodes.forEach(expandNode)
  }

  on<K extends keyof TreeEvents>(event: K, callback: TreeEvents[K]): void {
    this.events[event] = callback
  }

  getSelectedNode(): TreeNode | null {
    return this.selectedNode
  }

  selectNodeById(nodeId: string): void {
    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          return node
        }
        if (node.children) {
          const found = findNode(node.children)
          if (found) return found
        }
      }
      return null
    }

    const node = findNode(this.nodes)
    if (node) {
      this.selectNode(node)
    }
  }

  expandAll(): void {
    const expandRecursive = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          this.expandedNodes.add(node.id)
          expandRecursive(node.children)
        }
      })
    }

    expandRecursive(this.nodes)
    this.renderTree()
  }

  collapseAll(): void {
    this.expandedNodes.clear()
    this.renderTree()
  }

  clear(): void {
    this.nodes = []
    this.selectedNode = null
    this.expandedNodes.clear()
    this.clearFilters()
    
    const treeView = this.element.querySelector('#tree-view') as HTMLElement
    treeView.innerHTML = '<div class="tree-placeholder">Run a diff to see the collection structure and changes</div>'
    
    const statsContainer = this.element.querySelector('#tree-stats') as HTMLElement
    statsContainer.innerHTML = ''
    
    // Reset filter counts
    const filterChips = this.element.querySelectorAll('.filter-chip')
    filterChips.forEach(chip => {
      const countElement = chip.querySelector('.filter-count') as HTMLElement
      countElement.textContent = '0'
    })
  }
}