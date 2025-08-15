import type { PostmanCollection } from '../types'

export class FileInputComponent {
  private element: HTMLElement
  private onFileLoad?: (collection: PostmanCollection) => void

  constructor(containerId: string, label: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.element = this.createElement(label)
    container.appendChild(this.element)
  }

  private createElement(label: string): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 transition-all duration-300 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg'

    wrapper.innerHTML = `
      <div class="flex flex-col gap-4">
        <label class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">${label}</label>
        <input 
          type="file" 
          accept=".json" 
          class="w-full p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer transition-all duration-300 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
        />
        <div class="file-status text-zinc-600 dark:text-zinc-400">No file selected</div>
      </div>
    `

    const input = wrapper.querySelector('input[type="file"]') as HTMLInputElement
    const status = wrapper.querySelector('.file-status') as HTMLDivElement

    input.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) {
        status.textContent = 'No file selected'
        status.className = 'file-status text-zinc-600 dark:text-zinc-400'
        return
      }

      status.textContent = `Loading ${file.name}...`
      status.className = 'file-status loading'

      this.loadFile(file)
        .then(collection => {
          status.textContent = `✓ ${file.name}`
          status.className = 'file-status success'
          this.onFileLoad?.(collection)
        })
        .catch(error => {
          status.textContent = `✗ Error: ${error.message}`
          status.className = 'file-status error'
        })
    })

    return wrapper
  }

  private async loadFile(file: File): Promise<PostmanCollection> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = event => {
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

  onLoad(callback: (collection: PostmanCollection) => void): void {
    this.onFileLoad = callback
  }
}
