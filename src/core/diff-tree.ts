/**
 * Tree Diff Algorithm for Postman Collections
 * 
 * Implements the algorithm from section 4.1 to detect structural changes
 * between two Postman collection ASTs including moves, renames, and modifications.
 */

import type { AstNode, AstResult } from './ast.js';

export type DiffStatus = 'added' | 'removed' | 'moved' | 'renamed' | 'modified' | 'unchanged';

export interface DiffNode {
  id: string;
  type: AstNode['type'];
  name: string;
  path: string[];
  status: DiffStatus;
  oldNode?: AstNode;
  newNode?: AstNode;
  moveDetails?: {
    oldPath: string[];
    newPath: string[];
  };
  renameDetails?: {
    oldName: string;
    newName: string;
  };
}

export interface DiffSummary {
  added: number;
  removed: number;
  moved: number;
  renamed: number;
  modified: number;
  unchanged: number;
  total: number;
  descriptions: string[];
}

export interface TreeDiffResult {
  nodes: DiffNode[];
  summary: DiffSummary;
  nodeMap: { [id: string]: DiffNode };
}

/**
 * Creates a content hash lookup map from AST nodes
 */
function createContentHashMap(ast: AstResult): Map<string, AstNode[]> {
  const contentHashMap = new Map<string, AstNode[]>();
  
  for (const node of Object.values(ast.nodeMap)) {
    // For content-based matching, use content hash for requests or structure hash for folders/collections
    const hash = node.hashes.content || node.hashes.structure;
    
    if (!contentHashMap.has(hash)) {
      contentHashMap.set(hash, []);
    }
    contentHashMap.get(hash)!.push(node);
  }
  
  return contentHashMap;
}

/**
 * Creates a path key lookup map from AST nodes
 * Path key is: type + "/" + path.join("/")
 */
function createPathKeyMap(ast: AstResult): Map<string, AstNode> {
  const pathKeyMap = new Map<string, AstNode>();
  
  for (const node of Object.values(ast.nodeMap)) {
    const pathKey = node.type + "/" + node.path.join("/");
    pathKeyMap.set(pathKey, node);
  }
  
  return pathKeyMap;
}

/**
 * Determines if a node has been moved by comparing parent paths
 */
function isMovedNode(oldNode: AstNode, newNode: AstNode): boolean {
  if (oldNode.path.length !== newNode.path.length) return true;
  
  // Compare all path components except the last one (which is the node name)
  for (let i = 0; i < oldNode.path.length - 1; i++) {
    if (oldNode.path[i] !== newNode.path[i]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determines if a node has been renamed by comparing names
 */
function isRenamedNode(oldNode: AstNode, newNode: AstNode): boolean {
  return oldNode.name !== newNode.name;
}

/**
 * Determines if a node's content has been modified
 */
function isModifiedNode(oldNode: AstNode, newNode: AstNode): boolean {
  // For requests, compare content hashes
  if (oldNode.type === 'request' && newNode.type === 'request') {
    return oldNode.hashes.content !== newNode.hashes.content;
  }
  
  // For folders and collections, they're modified if their structure hash changed
  // (but this is mainly handled by children changes)
  return false;
}

/**
 * Creates a DiffNode from old and new AST nodes
 */
function createDiffNode(
  oldNode: AstNode | undefined,
  newNode: AstNode | undefined,
  status: DiffStatus
): DiffNode {
  const node = newNode || oldNode!;
  
  const diffNode: DiffNode = {
    id: node.id,
    type: node.type,
    name: node.name,
    path: node.path,
    status,
    oldNode,
    newNode
  };
  
  // Add move details if applicable
  if (status === 'moved' && oldNode && newNode && isMovedNode(oldNode, newNode)) {
    diffNode.moveDetails = {
      oldPath: oldNode.path,
      newPath: newNode.path
    };
  }
  
  // Add rename details if applicable
  if ((status === 'renamed' || status === 'moved') && oldNode && newNode && isRenamedNode(oldNode, newNode)) {
    diffNode.renameDetails = {
      oldName: oldNode.name,
      newName: newNode.name
    };
  }
  
  return diffNode;
}

/**
 * Generates human-readable descriptions for changes
 */
function generateDescriptions(nodes: DiffNode[]): string[] {
  const descriptions: string[] = [];
  
  // Group changes by type for better descriptions
  const addedItems = nodes.filter(n => n.status === 'added');
  const removedItems = nodes.filter(n => n.status === 'removed');
  const movedItems = nodes.filter(n => n.status === 'moved');
  const renamedItems = nodes.filter(n => n.status === 'renamed');
  const modifiedItems = nodes.filter(n => n.status === 'modified');
  
  // Added items
  if (addedItems.length > 0) {
    const byType = addedItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(byType)) {
      const plural = count > 1 ? 's' : '';
      descriptions.push(`Added ${count} ${type}${plural}`);
    }
  }
  
  // Removed items
  if (removedItems.length > 0) {
    const byType = removedItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(byType)) {
      const plural = count > 1 ? 's' : '';
      descriptions.push(`Removed ${count} ${type}${plural}`);
    }
  }
  
  // Moved items
  for (const item of movedItems) {
    const isAlsoRenamed = item.renameDetails;
    if (isAlsoRenamed) {
      descriptions.push(
        `Moved and renamed ${item.type} from "${item.oldNode!.path.join('/')}" to "${item.newNode!.path.join('/')}"`
      );
    } else {
      descriptions.push(
        `Moved ${item.type} "${item.name}" from "${item.oldNode!.path.slice(0, -1).join('/')}" to "${item.newNode!.path.slice(0, -1).join('/')}"`
      );
    }
  }
  
  // Renamed items (that weren't moved)
  for (const item of renamedItems) {
    descriptions.push(
      `Renamed ${item.type} from "${item.renameDetails!.oldName}" to "${item.renameDetails!.newName}"`
    );
  }
  
  // Modified items
  if (modifiedItems.length > 0) {
    const byType = modifiedItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(byType)) {
      const plural = count > 1 ? 's' : '';
      descriptions.push(`Modified ${count} ${type}${plural}`);
    }
  }
  
  return descriptions;
}

/**
 * Main tree diff algorithm implementation
 * 
 * Algorithm from section 4.1:
 * 1. Build content hash maps for both ASTs
 * 2. Build path key maps for both ASTs  
 * 3. For each node in old AST, determine its status
 * 4. For each unmatched node in new AST, mark as added
 * 5. Generate summary and descriptions
 */
export function diffTrees(oldAst: AstResult, newAst: AstResult): TreeDiffResult {
  const diffNodes: DiffNode[] = [];
  const matched = new Set<string>(); // Track matched new nodes by ID
  
  // Create lookup maps
  const newContentHashMap = createContentHashMap(newAst);
  const newPathKeyMap = createPathKeyMap(newAst);
  
  // Phase 1: Process all nodes from old AST
  for (const oldNode of Object.values(oldAst.nodeMap)) {
    const oldHash = oldNode.hashes.content || oldNode.hashes.structure;
    const oldPathKey = oldNode.type + "/" + oldNode.path.join("/");
    
    // Try to find matching node in new AST
    let newNode: AstNode | undefined;
    let status: DiffStatus;
    
    // First, try exact path match (unchanged or modified)
    newNode = newPathKeyMap.get(oldPathKey);
    if (newNode) {
      matched.add(newNode.id);
      
      if (isModifiedNode(oldNode, newNode)) {
        status = 'modified';
      } else {
        status = 'unchanged';
      }
    }
    // Second, try content/structure hash match (moved/renamed)
    else if (newContentHashMap.has(oldHash)) {
      const candidates = newContentHashMap.get(oldHash)!;
      
      // Find the best candidate (prefer one that wasn't already matched)
      newNode = candidates.find(candidate => !matched.has(candidate.id));
      
      if (newNode) {
        matched.add(newNode.id);
        
        // Determine if it was moved, renamed, or both
        const wasMoved = isMovedNode(oldNode, newNode);
        const wasRenamed = isRenamedNode(oldNode, newNode);
        
        if (wasMoved && wasRenamed) {
          status = 'moved'; // We'll capture both move and rename in the details
        } else if (wasMoved) {
          status = 'moved';
        } else if (wasRenamed) {
          status = 'renamed';
        } else {
          // Same content hash and same location - should be unchanged
          status = 'unchanged';
        }
      } else {
        // Content exists but all candidates already matched
        status = 'removed';
      }
    }
    // No match found - removed
    else {
      status = 'removed';
    }
    
    diffNodes.push(createDiffNode(oldNode, newNode, status));
  }
  
  // Phase 2: Process unmatched nodes from new AST (these are added)
  for (const newNode of Object.values(newAst.nodeMap)) {
    if (!matched.has(newNode.id)) {
      diffNodes.push(createDiffNode(undefined, newNode, 'added'));
    }
  }
  
  // Create node map for quick lookups
  const nodeMap: { [id: string]: DiffNode } = {};
  for (const node of diffNodes) {
    nodeMap[node.id] = node;
  }
  
  // Generate summary
  const summary: DiffSummary = {
    added: 0,
    removed: 0,
    moved: 0,
    renamed: 0,
    modified: 0,
    unchanged: 0,
    total: diffNodes.length,
    descriptions: []
  };
  
  // Count by status
  for (const node of diffNodes) {
    summary[node.status]++;
  }
  
  // Generate descriptions
  summary.descriptions = generateDescriptions(diffNodes);
  
  return {
    nodes: diffNodes,
    summary,
    nodeMap
  };
}

/**
 * Helper function to get diff nodes by status
 */
export function getDiffNodesByStatus(diff: TreeDiffResult, status: DiffStatus): DiffNode[] {
  return diff.nodes.filter(node => node.status === status);
}

/**
 * Helper function to get diff nodes by type
 */
export function getDiffNodesByType(diff: TreeDiffResult, type: AstNode['type']): DiffNode[] {
  return diff.nodes.filter(node => node.type === type);
}

/**
 * Helper function to check if there are any structural changes
 */
export function hasStructuralChanges(diff: TreeDiffResult): boolean {
  const { summary } = diff;
  return summary.added > 0 || summary.removed > 0 || summary.moved > 0 || summary.renamed > 0;
}

/**
 * Helper function to check if there are any content changes
 */
export function hasContentChanges(diff: TreeDiffResult): boolean {
  return diff.summary.modified > 0;
}

/**
 * Helper function to get a summary string of all changes
 */
export function getDiffSummaryString(diff: TreeDiffResult): string {
  const { summary } = diff;
  
  if (summary.total === summary.unchanged) {
    return "No changes detected";
  }
  
  const parts: string[] = [];
  
  if (summary.added > 0) parts.push(`${summary.added} added`);
  if (summary.removed > 0) parts.push(`${summary.removed} removed`);
  if (summary.moved > 0) parts.push(`${summary.moved} moved`);
  if (summary.renamed > 0) parts.push(`${summary.renamed} renamed`);
  if (summary.modified > 0) parts.push(`${summary.modified} modified`);
  if (summary.unchanged > 0) parts.push(`${summary.unchanged} unchanged`);
  
  return parts.join(", ");
}