import type { DiffOptions } from '../types'

export interface ToggleOption {
  key: keyof DiffOptions
  label: string
  description: string
  defaultValue: boolean
}

export interface OptionTogglesOptions {
  onOptionsChange?: (options: DiffOptions) => void
}

export class OptionTogglesComponent {
  private element: HTMLElement
  private options: DiffOptions
  private toggleOptions: ToggleOption[]
  private onOptionsChange?: (options: DiffOptions) => void

  constructor(containerId: string, opts: OptionTogglesOptions = {}) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`)
    }

    this.onOptionsChange = opts.onOptionsChange

    // Define available toggle options
    this.toggleOptions = [
      {
        key: 'ignoreOrder',
        label: 'Ignore Order',
        description: 'Ignore the order of items when comparing',
        defaultValue: false
      },
      {
        key: 'ignoreWhitespace',
        label: 'Ignore Whitespace',
        description: 'Normalize whitespace differences',
        defaultValue: true
      },
      {
        key: 'normalizeJson',
        label: 'Normalize JSON',
        description: 'Standardize JSON formatting before comparison',
        defaultValue: true
      },
      {
        key: 'sortKeys',
        label: 'Sort Keys',
        description: 'Sort object keys alphabetically',
        defaultValue: true
      }
    ]

    // Initialize options with defaults
    this.options = this.toggleOptions.reduce((acc, option) => {
      acc[option.key] = option.defaultValue
      return acc
    }, {} as DiffOptions)

    this.element = this.createElement()
    container.appendChild(this.element)
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden transition-colors duration-300'

    wrapper.innerHTML = `
      <div class="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex justify-between items-center transition-colors duration-300">
        <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Comparison Options</h3>
        <button class="toggle-control-btn px-2 py-1 text-xs bg-transparent border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-200" data-action="reset" title="Reset to Defaults">
          <span class="icon">↺</span>
        </button>
      </div>
      <div class="p-4 space-y-4">
        ${this.renderToggles()}
      </div>
    `

    this.setupEventListeners(wrapper)
    return wrapper
  }

  private renderToggles(): string {
    return this.toggleOptions.map(option => {
      const isChecked = this.options[option.key]
      const toggleClass = isChecked ? 'toggle-switch checked' : 'toggle-switch'
      
      return `
        <div class="toggle-option">
          <label class="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              class="toggle-input sr-only" 
              data-option="${option.key}"
              ${isChecked ? 'checked' : ''}
            >
            <span class="${toggleClass}">
              <span class="toggle-slider"></span>
            </span>
            <div class="flex-1">
              <span class="block text-zinc-900 dark:text-zinc-100 font-medium text-sm">${option.label}</span>
              <span class="block text-zinc-600 dark:text-zinc-400 text-xs mt-0.5">${option.description}</span>
            </div>
          </label>
        </div>
      `
    }).join('')
  }

  private setupEventListeners(wrapper: HTMLElement): void {
    wrapper.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      
      // Handle control buttons
      const controlBtn = target.closest('.toggle-control-btn') as HTMLElement
      if (controlBtn) {
        const action = controlBtn.dataset.action
        if (action === 'reset') {
          this.resetToDefaults()
        }
        return
      }
    })

    wrapper.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement
      
      if (target.classList.contains('toggle-input')) {
        const optionKey = target.dataset.option as keyof DiffOptions
        if (optionKey) {
          this.updateOption(optionKey, target.checked)
        }
      }
    })
  }

  private updateOption(key: keyof DiffOptions, value: boolean): void {
    this.options[key] = value
    this.updateToggleDisplay(key, value)
    this.onOptionsChange?.(this.options)
  }

  private updateToggleDisplay(key: keyof DiffOptions, value: boolean): void {
    const toggleOption = this.element.querySelector(`[data-option="${key}"]`)?.closest('.toggle-option') as HTMLElement
    if (toggleOption) {
      if (value) {
        toggleOption.classList.add('checked')
      } else {
        toggleOption.classList.remove('checked')
      }
    }
  }

  private resetToDefaults(): void {
    this.toggleOptions.forEach(option => {
      this.options[option.key] = option.defaultValue
      
      const input = this.element.querySelector(`[data-option="${option.key}"]`) as HTMLInputElement
      if (input) {
        input.checked = option.defaultValue
        this.updateToggleDisplay(option.key, option.defaultValue)
      }
    })

    this.onOptionsChange?.(this.options)
  }

  /**
   * Gets current options
   */
  getOptions(): DiffOptions {
    return { ...this.options }
  }

  /**
   * Sets options programmatically
   */
  setOptions(newOptions: Partial<DiffOptions>): void {
    Object.entries(newOptions).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        this.updateOption(key as keyof DiffOptions, value)
        
        const input = this.element.querySelector(`[data-option="${key}"]`) as HTMLInputElement
        if (input) {
          input.checked = value
        }
      }
    })
  }

  /**
   * Enables or disables all toggles
   */
  setEnabled(enabled: boolean): void {
    const inputs = this.element.querySelectorAll('.toggle-input') as NodeListOf<HTMLInputElement>
    const controlBtn = this.element.querySelector('.toggle-control-btn') as HTMLButtonElement
    
    inputs.forEach(input => {
      input.disabled = !enabled
    })
    
    if (controlBtn) {
      controlBtn.disabled = !enabled
    }

    if (enabled) {
      this.element.classList.remove('opacity-50', 'pointer-events-none')
    } else {
      this.element.classList.add('opacity-50', 'pointer-events-none')
    }
  }
}