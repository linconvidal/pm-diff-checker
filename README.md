# Postman Collection Diff Viewer

A professional, client-side static web application for comparing Postman collections with clean, GitHub-style diffs. Perfect for tracking API changes, reviewing collection updates, and maintaining API documentation.

![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4)

## ✨ Features

### 🎯 Core Functionality
- **100% Client-Side**: All processing happens in your browser - no data sent to servers
- **Smart Normalization**: Removes volatile fields (IDs, timestamps) for meaningful diffs
- **Structure Detection**: Identifies moved, renamed, added, and removed items
- **Content Diffing**: Deep comparison of requests, headers, bodies, and scripts
- **GitHub-Style Rendering**: Beautiful side-by-side or unified diff views

### 🎨 Modern UI/UX
- **Dark/Light Mode**: System-aware theme with manual toggle
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Interactive Tree View**: Navigate your collection structure with ease
- **Real-time Updates**: Changes reflect immediately as you adjust settings
- **Professional Styling**: Modern Tailwind CSS design

### 🔧 Advanced Features
- **Prettier Integration**: Format JavaScript test/pre-request scripts
- **JSON Prettification**: Clean JSON body formatting
- **Export Options**: Generate Markdown reports or JSON diff data
- **Configurable Comparison**: Toggle various normalization options
- **Drag & Drop**: Easy file loading with visual feedback

## 🚀 Quick Start

### Use Online (GitHub Pages)
Visit the live application: [https://your-username.github.io/pm-diff-checker/](https://your-username.github.io/pm-diff-checker/)

### Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/pm-diff-checker.git
cd pm-diff-checker

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📖 Usage

1. **Load Collections**: 
   - Drag & drop or click to select two Postman collection JSON files (v2.1)
   - Old collection on the left, new collection on the right

2. **Configure Options**:
   - **Ignore Order**: Don't flag reordering as changes
   - **Ignore Whitespace**: Skip whitespace-only changes
   - **Normalize JSON**: Pretty-print JSON bodies before comparison
   - **Sort Keys**: Sort object keys for consistent comparison

3. **Navigate Changes**:
   - Use the tree view to explore your collection structure
   - Click on any item to see detailed diffs
   - Filter by change type (Added, Removed, Modified, etc.)

4. **Export Results**:
   - **Markdown**: Generate a report with statistics and change details
   - **JSON**: Export complete diff data for further processing

## 🏗️ Architecture

### Technology Stack
- **Build Tool**: Vite (fast HMR, optimized builds)
- **Language**: TypeScript (type safety, better DX)
- **Styling**: Tailwind CSS (utility-first, responsive)
- **Diff Engine**: jsdiff (robust text diffing)
- **Diff Rendering**: diff2html (GitHub-style visualization)
- **Code Formatting**: Prettier (optional script formatting)

### Project Structure
```
pm-diff-checker/
├── src/
│   ├── core/           # Normalization and diff algorithms
│   │   ├── parse.ts       # Collection parsing and validation
│   │   ├── normalize.ts   # Normalization rules
│   │   ├── ast.ts         # AST builder
│   │   ├── hash.ts        # Content hashing
│   │   ├── diff-tree.ts   # Structure diff algorithm
│   │   └── diff-request.ts # Content diff algorithm
│   ├── ui/             # UI components
│   │   ├── file-input.ts   # File upload handling
│   │   ├── tree-view.ts    # Collection tree display
│   │   ├── render-diff.ts  # Diff visualization
│   │   └── ...
│   ├── types/          # TypeScript definitions
│   └── main.ts         # Application orchestrator
├── docs/               # GitHub Pages build output
└── index.html          # Application entry point
```

## 🔄 Normalization Rules

The app applies smart normalization to focus on meaningful changes:

### Removed Fields
- Volatile IDs: `_postman_id`, `uid`, `_exporter_id`
- Timestamps: `createdAt`, `updatedAt`
- Owner/fork information

### Normalized Elements
- **Scripts**: Event arrays joined and formatted with Prettier
- **Headers/Query**: Sorted, trimmed, deduplicated
- **URLs**: Canonical format with sorted query parameters
- **Bodies**: JSON pretty-printed, form-data sorted
- **Items**: Sorted by name for stable comparison

## 🎯 Change Detection

### Structure Changes
- **Added**: New items in the collection
- **Removed**: Deleted items
- **Moved**: Items relocated to different folders
- **Renamed**: Items with changed names
- **Modified**: Items with content changes

### Content Changes
- Method modifications (GET → POST)
- URL changes
- Header additions/removals
- Query parameter updates
- Body content changes
- Script modifications

## 🛡️ Privacy & Security

- **100% Client-Side**: No server processing or data transmission
- **No Analytics**: Zero tracking or telemetry
- **No External Calls**: Works completely offline after loading
- **Open Source**: Full transparency of code

## 📋 Requirements

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Postman Collection Format
- Version 2.1 (standard export format)
- JSON format (not YAML)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [diff](https://github.com/kpdecker/jsdiff) - Text diffing library
- [diff2html](https://github.com/rtfpessoa/diff2html) - Diff to HTML generator
- [Prettier](https://prettier.io/) - Code formatter
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling

## 🐛 Known Limitations

- Very large collections (>10MB) may be slower to process
- Binary file attachments in requests are not compared
- GraphQL body comparisons are treated as raw text
- Some Postman-specific features (variables, environments) are not fully expanded

## 📧 Support

For issues, questions, or suggestions, please [open an issue](https://github.com/your-username/pm-diff-checker/issues) on GitHub.