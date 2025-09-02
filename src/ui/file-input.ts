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
    wrapper.className = 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4'

    wrapper.innerHTML = `
      <div class="flex flex-col gap-3">
        <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">${label}</label>
        <input 
          type="file" 
          accept=".json" 
          class="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 cursor-pointer hover:bg-white dark:hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-600" 
        />
        <div class="file-status text-xs">No file selected</div>
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
          status.textContent = file.name
          status.className = 'file-status success'
          this.onFileLoad?.(collection)
        })
        .catch(error => {
          status.textContent = `Error: ${error.message}`
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
