// Test script to verify the export functionality fix
import { ExportControlsComponent } from './src/ui/export-controls.js';

// Create mock data that simulates what the differ produces
const mockDiffResult = {
  oldCollection: '{"info":{"name":"Old Collection"}}', // This won't be used anymore
  newCollection: '{"info":{"name":"New Collection"}}', // This won't be used anymore
  patches: [
    {
      value: 'endpoint: /api/users',
      added: true,
      removed: false
    },
    {
      value: 'endpoint: /api/products',
      removed: true,
      added: false  
    },
    {
      value: '{"method": "GET", "url": "/api/test"}',
      added: false,
      removed: false
    }
  ],
  htmlDiff: '<div>HTML diff content</div>'
};

const mockData = {
  oldCollection: { info: { name: 'Test Old Collection' } },
  newCollection: { info: { name: 'Test New Collection' } },
  diffResult: mockDiffResult
};

// Create a test instance
const exportControls = new ExportControlsComponent('test-container', {});

// Update with mock data
exportControls.updateData(mockData);

// Generate the markdown report
const markdown = exportControls.generateMarkdownReport();

console.log('Generated Markdown Report:');
console.log('===========================');
console.log(markdown);
console.log('===========================');

// Check if the old issue is fixed
if (markdown.includes('"info":{"name":"Old Collection"}')) {
  console.error('❌ ERROR: The export still contains raw JSON from oldCollection!');
} else {
  console.log('✅ SUCCESS: The export no longer contains raw JSON dumps!');
}

// Check if patches are properly formatted
if (markdown.includes('## Detailed Changes')) {
  console.log('✅ SUCCESS: Detailed changes section is present');
}

if (markdown.includes('✅ Added') || markdown.includes('❌ Removed')) {
  console.log('✅ SUCCESS: Individual changes are properly formatted');
}