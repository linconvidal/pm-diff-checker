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
    wrapper.className = 'bg-white dark:bg-zinc-950'

    wrapper.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div class="flex gap-1">
          <button class="tree-control-btn p-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" data-action="expand-all" title="Expand All">
            <span class="font-mono">+</span>
          </button>
          <button class="tree-control-btn p-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" data-action="collapse-all" title="Collapse All">
            <span class="font-mono">−</span>
          </button>
        </div>
      </div>
      <div class="tree-content overflow-y-auto">
        <div class="tree-placeholder text-sm text-zinc-500 dark:text-zinc-500 py-8">
          No collections loaded
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
   * Updates tree with diff information - shows only changed items
   */
  updateWithDiff(oldCollection: NormalizedCollection, newCollection: NormalizedCollection): void {
    // Build maps of ALL items including folders
    const oldItems = this.flattenItems(oldCollection.items)
    const newItems = this.flattenItems(newCollection.items)
    
    const oldMap = new Map(oldItems.map(item => [item.id, item]))
    const newMap = new Map(newItems.map(item => [item.id, item]))
    
    const changedItems: any[] = []
    
    // Find removed items (including folders)
    oldMap.forEach((item, id) => {
      if (!newMap.has(id)) {
        changedItems.push({ ...item, changeType: 'removed' })
      }
    })
    
    // Find added and modified items (including folders with tests/scripts)
    newMap.forEach((item, id) => {
      if (!oldMap.has(id)) {
        changedItems.push({ ...item, changeType: 'added' })
      } else {
        const oldItem = oldMap.get(id)!
        if (this.hasItemChanged(oldItem, item)) {
          const changes = this.getItemChanges(oldItem, item)
          changedItems.push({ ...item, changeType: 'modified', changeDetails: changes })
        }
      }
    })
    
    // Now build tree structure showing only changed items with their paths
    this.tree = this.buildTreeFromChangedItems(changedItems, newCollection.info.name)
    this.render()
  }
  
  private buildTreeFromChangedItems(items: any[], collectionName: string): TreeNode[] {
    if (items.length === 0) {
      return [{
        id: 'no-changes',
        name: 'No changes detected',
        type: 'collection',
        expanded: true
      }]
    }
    
    // Group items by their parent path
    const grouped = new Map<string, any[]>()
    
    items.forEach(item => {
      const parentPath = item.parentPath || ''
      if (!grouped.has(parentPath)) {
        grouped.set(parentPath, [])
      }
      grouped.get(parentPath)!.push(item)
    })
    
    // Count changes by type
    const addedCount = items.filter(i => i.changeType === 'added').length
    const removedCount = items.filter(i => i.changeType === 'removed').length
    const modifiedCount = items.filter(i => i.changeType === 'modified').length
    
    // Build tree structure
    const rootNode: TreeNode = {
      id: 'changed-items',
      name: `${collectionName} (+${addedCount} -${removedCount} ~${modifiedCount})`,
      type: 'collection',
      expanded: true,
      children: [],
      changeType: 'modified'
    }
    
    // Add grouped items
    grouped.forEach((groupItems, path) => {
      if (path) {
        // Create folder node for this path
        const folderNode: TreeNode = {
          id: `folder-${path}`,
          name: path,
          type: 'folder',
          expanded: true,
          children: groupItems.map(item => this.createTreeNode(item)),
          changeType: 'modified'
        }
        rootNode.children!.push(folderNode)
      } else {
        // Root level items
        groupItems.forEach(item => {
          rootNode.children!.push(this.createTreeNode(item))
        })
      }
    })
    
    return [rootNode]
  }
  
  private createTreeNode(item: any): TreeNode {
    return {
      id: item.id,
      name: item.name,
      type: item.children ? 'folder' : 'request',
      method: item.method,
      changeType: item.changeType,
      changeDetails: item.changeDetails,
      expanded: false
    } as any
  }
  
  private flattenItems(items: NormalizedItem[], parentPath: string = ''): any[] {
    const result: any[] = []
    items.forEach(item => {
      const path = parentPath ? `${parentPath}/${item.name}` : item.name
      result.push({ ...item, path, parentPath })
      if (item.children) {
        result.push(...this.flattenItems(item.children, path))
      }
    })
    return result
  }
  
  private hasItemChanged(oldItem: any, newItem: any): boolean {
    // Compare scripts properly (they can be strings or arrays)
    const oldTests = Array.isArray(oldItem.tests) ? oldItem.tests.join('\n') : (oldItem.tests || '')
    const newTests = Array.isArray(newItem.tests) ? newItem.tests.join('\n') : (newItem.tests || '')
    const oldPre = Array.isArray(oldItem.prerequest) ? oldItem.prerequest.join('\n') : (oldItem.prerequest || '')
    const newPre = Array.isArray(newItem.prerequest) ? newItem.prerequest.join('\n') : (newItem.prerequest || '')
    
    // For folders, check if their tests or prerequest scripts changed
    if (oldItem.children && newItem.children) {
      // Folder-level scripts apply to all children
      return oldTests !== newTests || oldPre !== newPre
    }
    
    // For endpoints, check all properties
    return oldItem.method !== newItem.method ||
           oldItem.url !== newItem.url ||
           oldItem.body !== newItem.body ||
           JSON.stringify(oldItem.headers || {}) !== JSON.stringify(newItem.headers || {}) ||
           oldTests !== newTests ||
           oldPre !== newPre
  }
  
  private getItemChanges(oldItem: any, newItem: any): string {
    const changes: string[] = []
    
    // Compare scripts properly (they can be strings or arrays)
    const oldTests = Array.isArray(oldItem.tests) ? oldItem.tests.join('\n') : (oldItem.tests || '')
    const newTests = Array.isArray(newItem.tests) ? newItem.tests.join('\n') : (newItem.tests || '')
    const oldPre = Array.isArray(oldItem.prerequest) ? oldItem.prerequest.join('\n') : (oldItem.prerequest || '')
    const newPre = Array.isArray(newItem.prerequest) ? newItem.prerequest.join('\n') : (newItem.prerequest || '')
    
    if (oldItem.url !== newItem.url) changes.push('URL')
    if (oldItem.method !== newItem.method) changes.push('Method')
    if (oldItem.body !== newItem.body) changes.push('Body')
    if (JSON.stringify(oldItem.headers || {}) !== JSON.stringify(newItem.headers || {})) changes.push('Headers')
    if (oldTests !== newTests) changes.push('Tests')
    if (oldPre !== newPre) changes.push('Pre-request')
    
    return changes.join(', ')
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


  private render(): void {
    const contentElement = this.element.querySelector('.tree-content') as HTMLElement
    
    if (this.tree.length === 0) {
      contentElement.innerHTML = '<div class="tree-placeholder text-sm text-zinc-500 dark:text-zinc-500 py-8">No collections loaded</div>'
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
    const selectedClass = node.selected ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
    const indent = level * 16

    // Determine change type styling with clear labels
    let changeIndicator = ''
    let textColorClass = ''
    
    if (node.changeType === 'added') {
      changeIndicator = '<span class="inline-block px-1.5 py-0.5 text-[10px] font-mono text-green-600 dark:text-green-400">+</span>'
      textColorClass = ''
    } else if (node.changeType === 'removed') {
      changeIndicator = '<span class="inline-block px-1.5 py-0.5 text-[10px] font-mono text-red-600 dark:text-red-400">−</span>'
      textColorClass = 'line-through opacity-60'
    } else if (node.changeType === 'modified') {
      changeIndicator = '<span class="inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">●</span>'
      textColorClass = ''
    }

    let toggleButton = ''
    if (hasChildren) {
      const toggleIcon = isExpanded ? '▼' : '▶'
      toggleButton = `<button class="tree-toggle w-3 h-4 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 mr-1 text-[10px]">${toggleIcon}</button>`
    }

    // Show change details
    let changeDetails = ''
    if ((node as any).changeDetails) {
      changeDetails = `<span class="text-xs text-zinc-500 dark:text-zinc-400 ml-2">(${(node as any).changeDetails})</span>`
    }
    
    // Show type and method
    let methodBadge = ''
    if (node.type === 'request' && node.method) {
      const methodColor = node.method === 'GET' ? 'text-green-600' :
                         node.method === 'POST' ? 'text-blue-600' :
                         node.method === 'PUT' ? 'text-orange-600' :
                         node.method === 'DELETE' ? 'text-red-600' : 'text-zinc-600'
      methodBadge = `<span class="text-[10px] font-mono ${methodColor} dark:${methodColor.replace('600', '400')} ml-auto">${node.method}</span>`
    }

    let childrenHtml = ''
    if (hasChildren && isExpanded) {
      childrenHtml = `<div class="border-l border-zinc-200 dark:border-zinc-800 ml-2">${this.renderNodes(node.children!, level + 1)}</div>`
    }

    // Create clickable link to section
    const nodeId = node.changeType === 'added' ? 'added-section' : 
                   node.changeType === 'removed' ? 'removed-section' : 
                   node.changeType === 'modified' ? 'modified-section' : ''

    return `
      <div class="tree-node ${selectedClass}" data-node-id="${node.id}" data-section="${nodeId}">
        <div class="flex items-center py-1 px-2 cursor-pointer group" data-indent="${indent}" style="--indent: ${indent}">
          ${toggleButton}
          ${changeIndicator ? `<span class="mr-2">${changeIndicator}</span>` : ''}
          <span class="flex-1 text-sm ${textColorClass || 'text-zinc-900 dark:text-zinc-100'} ${node.type === 'folder' ? 'font-medium' : ''}">${node.name}</span>
          ${methodBadge}
          ${changeDetails}
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
    // Navigate to the specific item in the diff viewer
    let targetId = ''
    if (node.changeType === 'added') {
      targetId = `added-${node.id}`
    } else if (node.changeType === 'removed') {
      targetId = `removed-${node.id}`
    } else if (node.changeType === 'modified') {
      targetId = `modified-${node.id}`
    }
    
    if (targetId) {
      const targetElement = document.getElementById(targetId)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Highlight briefly
        targetElement.style.backgroundColor = '#fbbf24'
        setTimeout(() => {
          targetElement.style.backgroundColor = ''
        }, 1000)
      }
    }
    
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