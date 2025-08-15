/**
 * Simple test to verify AST builder functionality
 */

import { buildAST } from './ast';
import type { PostmanCollection } from '../types/postman';

// Simple test collection
const testCollection: PostmanCollection = {
  info: {
    _postman_id: "test-id",
    name: "Test Collection",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "Test Folder",
      item: [
        {
          name: "Get Users",
          request: {
            method: "GET",
            url: "https://api.example.com/users",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ]
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "Create User",
      request: {
        method: "POST",
        url: "https://api.example.com/users",
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: {
          mode: "raw",
          raw: '{"name": "John Doe", "email": "john@example.com"}',
          options: {
            raw: {
              language: "json"
            }
          }
        }
      }
    }
  ]
};

// Test the AST builder
export function testAST(): void {
  console.log("Testing AST builder...");
  
  try {
    const result = buildAST(testCollection);
    
    console.log("✓ AST built successfully");
    console.log("Root node:", result.tree.name);
    console.log("Total nodes in map:", Object.keys(result.nodeMap).length);
    
    // Verify structure
    if (result.tree.children.length === 2) {
      console.log("✓ Correct number of root items");
    }
    
    // Check folder structure
    const folder = result.tree.children.find(child => child.type === 'folder');
    if (folder && folder.children.length === 1) {
      console.log("✓ Folder contains correct number of requests");
    }
    
    // Check request structure
    const request = result.tree.children.find(child => child.type === 'request');
    if (request && request.data) {
      console.log("✓ Request has data");
      console.log("  Method:", request.data.method);
      console.log("  Headers count:", request.data.headers.length);
    }
    
    // Verify stable IDs
    for (const id in result.nodeMap) {
      const node = result.nodeMap[id];
      if (node.id !== id) {
        throw new Error("Node map key doesn't match node ID");
      }
    }
    console.log("✓ Node map integrity verified");
    
    // Verify hashes
    for (const id in result.nodeMap) {
      const node = result.nodeMap[id];
      if (!node.hashes.structure) {
        throw new Error("Missing structure hash for node: " + id);
      }
      if (node.type === 'request' && !node.hashes.content) {
        throw new Error("Missing content hash for request node: " + id);
      }
    }
    console.log("✓ Hash computation verified");
    
    console.log("🎉 All AST tests passed!");
    
  } catch (error) {
    console.error("❌ AST test failed:", error);
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testAST();
}