// Simple test for the diff-request functionality
import { diffRequests } from './src/core/diff-request.js'

// Mock normalized requests for testing
const oldRequest = {
  method: 'GET',
  url: {
    raw: 'https://api.example.com/users',
    host: 'api.example.com',
    path: '/users',
    query: ''
  },
  headers: [
    { key: 'Authorization', value: 'Bearer token123' },
    { key: 'Content-Type', value: 'application/json' }
  ],
  query: [
    { key: 'page', value: '1' },
    { key: 'limit', value: '10' }
  ],
  body: {
    mode: 'raw',
    content: '{"name": "test"}',
    contentType: 'json'
  }
}

const newRequest = {
  method: 'POST',
  url: {
    raw: 'https://api.example.com/users',
    host: 'api.example.com', 
    path: '/users',
    query: ''
  },
  headers: [
    { key: 'Authorization', value: 'Bearer token456' },
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Accept', value: 'application/json' }
  ],
  query: [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' }
  ],
  body: {
    mode: 'raw',
    content: '{"name": "test", "email": "test@example.com"}',
    contentType: 'json'
  }
}

console.log('Testing request diff...')
const result = diffRequests(oldRequest, newRequest, 'test-request')

console.log('Has changes:', result.hasChanges)
console.log('Field changes:', result.fieldChanges.length)

result.fieldChanges.forEach(change => {
  console.log(`- ${change.field}: ${change.changeType} (${change.reason || 'no reason'})`)
})

console.log('✅ Test completed successfully!')