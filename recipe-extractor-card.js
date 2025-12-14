// Card configuration constants
const EXTRACTION_TIMEOUT_MS = 30000;  // 30 seconds timeout for extraction
const INFO_MESSAGE_DURATION_MS = 3000;  // How long info messages display
const SUCCESS_MESSAGE_DURATION_MS = 5000;  // How long success messages display

class RecipeExtractorCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.extractedRecipe = null;
  }

  /**
   * Set the card configuration
   * @param {Object} config - Card configuration object
   * @param {string} config.entity - Required todo entity ID
   * @param {string} [config.title] - Optional card title
   * @param {string} [config.button_text] - Optional button text
   * @param {string} [config.placeholder] - Optional input placeholder
   */
  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity (todo entity)');
    }
    this.config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.render();
    }
    
    // Set up event listeners for extraction progress
    if (!this._eventListenersSetup) {
      this.setupEventListeners();
      this._eventListenersSetup = true;
    }
  }

  /**
   * Validate URL for security (protocol and private IP checks)
   * @param {string} url - The URL to validate
   * @returns {{valid: boolean, error?: string}} Validation result
   */
  validateUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
      }
      
      // Prevent localhost/internal IPs for security
      const hostname = parsed.hostname.toLowerCase();
      
      // Check for localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return { valid: false, error: 'Internal/local URLs are not allowed' };
      }
      
      // Check if it's a private IP address (RFC1918 ranges)
      if (this.isPrivateIP(hostname)) {
        return { valid: false, error: 'Internal/local URLs are not allowed' };
      }
      
      return { valid: true };
    } catch (e) {
      return { valid: false, error: 'Please enter a valid URL' };
    }
  }

  /**
   * Check if a hostname is a private IP address (RFC1918)
   * @param {string} hostname - The hostname to check
   * @returns {boolean} True if hostname is a private IP
   */
  isPrivateIP(hostname) {
    // Try to parse as IPv4
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    
    if (match) {
      const octets = match.slice(1).map(Number);
      
      // Validate octets are in valid range
      if (octets.some(octet => octet > 255)) {
        return false;
      }
      
      // Check RFC1918 private ranges:
      // 10.0.0.0 - 10.255.255.255 (10/8 prefix)
      if (octets[0] === 10) return true;
      
      // 172.16.0.0 - 172.31.255.255 (172.16/12 prefix)
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
      
      // 192.168.0.0 - 192.168.255.255 (192.168/16 prefix)
      if (octets[0] === 192 && octets[1] === 168) return true;
      
      // 169.254.0.0 - 169.254.255.255 (link-local)
      if (octets[0] === 169 && octets[1] === 254) return true;
      
      // 127.0.0.0 - 127.255.255.255 (loopback)
      if (octets[0] === 127) return true;
    }
    
    return false;
  }

  /**
   * Set up Home Assistant event listeners for extraction progress
   * Prevents duplicate registration and stores unsubscribe functions
   */
  setupEventListeners() {
    // Prevent duplicate event listener registration
    if (this._eventListenersSetup) return;
    this._eventListenersSetup = true;

    // Listen for extraction method detection events
    this._unsubscribeMethodDetected = this._hass.connection.subscribeEvents((event) => {
      console.log('Extraction method detected:', event.data);
      const extractionMethod = event.data.extraction_method === 'json-ld'
        ? '⚡ Fast parsing (JSON-LD found)'
        : '🤖 AI extraction (may take ~10s)';
      this.showStatus(extractionMethod, 'info');
    }, 'recipe_extractor_method_detected');

    // Listen for extraction started events
    this._unsubscribeExtractionStarted = this._hass.connection.subscribeEvents((event) => {
      console.log('Extraction started:', event.data);
      this.showStatus('Checking recipe format...', 'info');
    }, 'recipe_extractor_extraction_started');
  }

  /**
   * Cleanup function called when card is removed from DOM
   * Unsubscribes from all Home Assistant events
   */
  disconnectedCallback() {
    // Clean up event listeners when card is removed
    if (this._unsubscribeMethodDetected) {
      this._unsubscribeMethodDetected();
      this._unsubscribeMethodDetected = null;
    }
    if (this._unsubscribeExtractionStarted) {
      this._unsubscribeExtractionStarted();
      this._unsubscribeExtractionStarted = null;
    }
  }

  /**
   * Render the card UI with inputs, buttons, and status areas
   */
  render() {
    if (!this.config || !this._hass) {
      return;
    }

    const title = this.config.title || 'Recipe Extractor';
    const buttonText = this.config.button_text || 'Extract to List';
    const placeholder = this.config.placeholder || 'Enter recipe URL...';

    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: 16px;
        }
        .card-header {
          font-size: 24px;
          font-weight: 500;
          margin-bottom: 16px;
          color: var(--primary-text-color);
        }
        .input-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .input-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .url-input {
          flex: 1;
          min-width: 0;
          padding: 12px;
          font-size: 16px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background-color: var(--card-background-color);
          color: var(--primary-text-color);
          box-sizing: border-box;
        }
        .url-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }
        .controls-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .button-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .button-row .button {
          flex: 1;
        }
        .button-row .servings-input {
          flex: 1;
          min-width: 0;
        }
        .servings-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .servings-label {
          font-size: 14px;
          color: var(--primary-text-color);
          white-space: nowrap;
        }
        .servings-input {
          padding: 12px;
          font-size: 16px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background-color: var(--card-background-color);
          color: var(--primary-text-color);
          box-sizing: border-box;
          text-align: center;
        }
        .servings-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background-color: var(--disabled-color, var(--secondary-background-color));
          pointer-events: none;
        }
        .button {
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary-color, white);
          background-color: var(--primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
          white-space: nowrap;
          width: 100%;
        }
        .button:hover {
          filter: brightness(1.1);
        }
        .button:active {
          filter: brightness(0.9);
        }
        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .button.secondary {
          background-color: var(--secondary-text-color);
        }
        .button.accent {
          background-color: var(--accent-color, var(--primary-color));
        }
        .status-message {
          padding: 8px;
          border-radius: 4px;
          font-size: 14px;
        }
        .status-message.success {
          background-color: var(--success-color, #4caf50);
          color: white;
        }
        .status-message.error {
          background-color: var(--error-color, #f44336);
          color: white;
        }
        .status-message.info {
          background-color: var(--info-color, #2196f3);
          color: white;
        }
        .hidden {
          display: none;
        }
        .recipe-info {
          padding: 12px;
          background-color: var(--secondary-background-color);
          border-radius: 4px;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .recipe-info strong {
          display: block;
          margin-bottom: 4px;
        }
        @media (max-width: 500px) {
          .input-row {
            flex-direction: column;
          }
          .servings-input {
            width: 100%;
          }
        }
      </style>
      <ha-card>
        <div class="input-container">
          <div class="input-row">
            <input
              type="url"
              class="url-input"
              placeholder="${placeholder}"
              id="recipeUrl"
              aria-label="Recipe URL input"
              aria-describedby="statusMessage"
            />
          </div>
          <div class="controls-group">
            <div class="button-row">
              <button 
                class="button" 
                id="extractButton"
                aria-label="Extract recipe from URL">
                Extract
              </button>
              <input
                type="number"
                class="servings-input"
                id="targetServings"
                placeholder="Portions"
                min="0.1"
                max="100"
                step="0.1"
                disabled
                aria-label="Target number of servings"
              />
              <button 
                class="button" 
                id="addToListButton" 
                disabled
                aria-label="Add extracted ingredients to shopping list">
                Add to List
              </button>
            </div>
            <button 
              class="button accent" 
              id="extractAndAddButton"
              aria-label="Extract recipe and add ingredients to list in one step">
              Extract + Add
            </button>
          </div>
          <div 
            id="statusMessage" 
            class="status-message hidden"
            role="status"
            aria-live="polite"
            aria-atomic="true">
          </div>
          <div 
            id="recipeInfo" 
            class="recipe-info hidden"
            role="region"
            aria-label="Extracted recipe information">
            <strong id="recipeTitle"></strong>
            <span id="recipeDetails"></span>
          </div>
        </div>
      </ha-card>
    `;

    this.content = true;
    
    // Ensure portions field starts empty and disabled
    const targetServingsInput = this.shadowRoot.getElementById('targetServings');
    if (targetServingsInput) {
      targetServingsInput.value = '';
      targetServingsInput.disabled = true;
    }
    
    this.setupListeners();
  }

  /**
   * Set up event listeners for all buttons and inputs
   */
  setupListeners() {
    const extractButton = this.shadowRoot.getElementById('extractButton');
    const addToListButton = this.shadowRoot.getElementById('addToListButton');
    const extractAndAddButton = this.shadowRoot.getElementById('extractAndAddButton');
    const input = this.shadowRoot.getElementById('recipeUrl');
    const statusMessage = this.shadowRoot.getElementById('statusMessage');
    const recipeInfo = this.shadowRoot.getElementById('recipeInfo');

    // Handle Enter key in input
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        extractButton.click();
      }
    });

    // Step 1: Extract recipe (without adding to list)
    extractButton.addEventListener('click', async () => {
      const url = input.value.trim();

      if (!url) {
        this.showStatus('Please enter a recipe URL', 'error');
        return;
      }

      // Improved URL validation
      const validation = this.validateUrl(url);
      if (!validation.valid) {
        this.showStatus(validation.error, 'error');
        return;
      }

      extractButton.disabled = true;
      extractAndAddButton.disabled = true;
      recipeInfo.classList.add('hidden');
      this.showStatus('Starting extraction...', 'info');

      // Set up timeout for extraction
      const timeoutId = setTimeout(() => {
        this.showStatus('Extraction timed out. Please try again.', 'error');
        extractButton.disabled = false;
        extractAndAddButton.disabled = false;
      }, EXTRACTION_TIMEOUT);

      try {
        // Call the extract service (events will update status)
        const response = await this._hass.callWS({
          type: 'call_service',
          domain: 'recipe_extractor',
          service: 'extract',
          target: {},
          service_data: {
            url: url,
          },
          return_response: true,
        });

        clearTimeout(timeoutId);
        console.log('Full recipe extraction response:', response);

        // The response data is nested under 'response'
        const data = response?.response || response;
        console.log('Extracted data:', data);

        // Check if the response contains an error
        if (data && data.error) {
          this.showStatus('Error: ' + data.error, 'error');
          return;
        }

        // Store extracted recipe
        this.extractedRecipe = data;
        this.currentUrl = url;

        // Show recipe info
        this.showRecipeInfo(data);
        
        // Enable "Add to List" button and portions field
        addToListButton.disabled = false;
        const targetServingsInput = this.shadowRoot.getElementById('targetServings');
        targetServingsInput.disabled = false;
        
        // Show success status
        this.showStatus(`Recipe extracted! Adjust portions if needed.`, 'success');

        // Clear success message after delay
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, INFO_MESSAGE_DURATION_MS);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error extracting recipe:', error);
        this.showStatus('Failed to extract recipe: ' + error.message, 'error');
      } finally {
        extractButton.disabled = false;
        extractAndAddButton.disabled = false;
      }
    });

    // Step 2: Add to list with adjusted servings
    addToListButton.addEventListener('click', async () => {
      if (!this.extractedRecipe) {
        this.showStatus('No recipe extracted', 'error');
        return;
      }

      const targetServingsInput = this.shadowRoot.getElementById('targetServings');
      const targetServings = parseFloat(targetServingsInput.value);

      if (targetServings && targetServings <= 0) {
        this.showStatus('Servings must be a positive number', 'error');
        return;
      }

      addToListButton.disabled = true;
      this.showStatus('Adding ingredients to list...', 'info');

      try {
        const serviceData = {
          recipe: this.extractedRecipe,  // Pass the already-extracted recipe data
          todo_entity: this.config.entity,
        };

        // Only add target_servings if it's different from original
        if (targetServings && targetServings !== this.extractedRecipe.servings) {
          serviceData.target_servings = targetServings;
        }

        const response = await this._hass.callWS({
          type: 'call_service',
          domain: 'recipe_extractor',
          service: 'add_to_list',
          target: {},
          service_data: serviceData,
          return_response: true,
        });

        const data = response?.response || response;

        if (data && data.error) {
          this.showStatus('Error: ' + data.error, 'error');
          return;
        }

        const itemsAdded = data?.items_added || 0;
        if (itemsAdded > 0) {
          this.showStatus(`Added ${itemsAdded} ingredients to list!`, 'success');
        } else {
          this.showStatus('No ingredients to add.', 'error');
        }

        // Clear input and success message after 5 seconds
        input.value = '';
        targetServingsInput.value = '';
        targetServingsInput.disabled = true;
        recipeInfo.classList.add('hidden');
        this.extractedRecipe = null;
        this.currentUrl = null;
        addToListButton.disabled = true;

        // Clear message after delay
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, SUCCESS_MESSAGE_DURATION_MS);
      } catch (error) {
        console.error('Error adding to list:', error);
        this.showStatus('Failed to add to list: ' + error.message, 'error');
      } finally {
        addToListButton.disabled = false;
      }
    });

    // Step 3: Extract and Add in one click
    extractAndAddButton.addEventListener('click', async () => {
      const url = input.value.trim();

      if (!url) {
        this.showStatus('Please enter a recipe URL', 'error');
        return;
      }

      // Improved URL validation
      const validation = this.validateUrl(url);
      if (!validation.valid) {
        this.showStatus(validation.error, 'error');
        return;
      }

      const targetServingsInput = this.shadowRoot.getElementById('targetServings');
      const targetServings = parseFloat(targetServingsInput.value);

      if (targetServings && targetServings <= 0) {
        this.showStatus('Servings must be a positive number', 'error');
        return;
      }

      extractButton.disabled = true;
      addToListButton.disabled = true;
      extractAndAddButton.disabled = true;
      recipeInfo.classList.add('hidden');
      this.showStatus('Starting extraction...', 'info');

      // Set up timeout for extraction
      const timeoutId = setTimeout(() => {
        this.showStatus('Extraction timed out. Please try again.', 'error');
        extractButton.disabled = false;
        addToListButton.disabled = true;
        extractAndAddButton.disabled = false;
      }, EXTRACTION_TIMEOUT_MS);

      try {
        // Call extract_to_list service (events will update status)
        const serviceData = {
          url: url,
          todo_entity: this.config.entity,
        };

        // Add target_servings if specified
        if (targetServings && targetServings > 0) {
          serviceData.target_servings = targetServings;
        }

        const response = await this._hass.callWS({
          type: 'call_service',
          domain: 'recipe_extractor',
          service: 'extract_to_list',
          target: {},
          service_data: serviceData,
          return_response: true,
        });

        const data = response?.response || response;

        clearTimeout(timeoutId);

        if (data && data.error) {
          this.showStatus('Error: ' + data.error, 'error');
          return;
        }

        const itemsAdded = data?.items_added || 0;
        if (itemsAdded > 0) {
          this.showStatus(`Added ${itemsAdded} ingredients to list!`, 'success');
        } else {
          this.showStatus('No ingredients to add.', 'error');
        }

        // Clear form
        input.value = '';
        targetServingsInput.value = '';
        targetServingsInput.disabled = true;
        recipeInfo.classList.add('hidden');
        this.extractedRecipe = null;
        this.currentUrl = null;

        // Clear message after delay
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, SUCCESS_MESSAGE_DURATION_MS);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error in extract and add:', error);
        this.showStatus('Failed to extract and add: ' + error.message, 'error');
      } finally {
        extractButton.disabled = false;
        addToListButton.disabled = true;
        extractAndAddButton.disabled = false;
      }
    });
  }

  /**
   * Display extracted recipe information in the card
   * @param {Object} recipeData - The extracted recipe data
   * @param {string} recipeData.title - Recipe title
   * @param {number} [recipeData.servings] - Number of servings
   * @param {Array} [recipeData.ingredients] - List of ingredients
   * @param {string} recipeData.extraction_method - 'json-ld' or 'ai'
   */
  showRecipeInfo(recipeData) {
    const recipeInfo = this.shadowRoot.getElementById('recipeInfo');
    const recipeTitle = this.shadowRoot.getElementById('recipeTitle');
    const recipeDetails = this.shadowRoot.getElementById('recipeDetails');
    const targetServingsInput = this.shadowRoot.getElementById('targetServings');

    // Set recipe title with extraction method indicator
    const extractionIcon = recipeData.extraction_method === 'json-ld' ? '⚡' : '🤖';
    recipeTitle.textContent = `${extractionIcon} ${recipeData.title || 'Recipe'}`;

    // Build details string
    const ingredientCount = recipeData.ingredients?.length || 0;
    const extractionLabel = recipeData.extraction_method === 'json-ld' 
        ? 'Parsing from JSON-LD' 
        : 'Converting using AI';
    let detailsText = `${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''} • ${extractionLabel}`;
    
    if (recipeData.servings) {
      detailsText += ` • ${recipeData.servings} serving${recipeData.servings !== 1 ? 's' : ''} (original)`;
      // Pre-fill the servings input with the original value
      targetServingsInput.value = recipeData.servings;
    }

    recipeDetails.textContent = detailsText;
    recipeInfo.classList.remove('hidden');
  }

  /**
   * Show a status message to the user
   * @param {string} message - The message to display
   * @param {'success'|'error'|'info'} type - The message type/severity
   */
  showStatus(message, type) {
    const statusMessage = this.shadowRoot.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.classList.remove('hidden');
  }

  /**
   * Get the card size for Home Assistant layout
   * @returns {number} The card size (grid rows)
   */
  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement('recipe-extractor-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'todo.shopping_list',
      title: 'Recipe Extractor',
      button_text: 'Extract to List',
      placeholder: 'Enter recipe URL...',
    };
  }
}

// Define the custom card editor
class RecipeExtractorCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    if (!this.content) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;
  }

  /**
   * Render the card editor UI with configuration inputs
   */
  render() {
    this.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;" for="entity">Entity (Todo List)*</label>
          <input
            type="text"
            id="entity"
            value="${this._config.entity || ''}"
            placeholder="todo.shopping_list"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
            aria-label="Todo list entity ID"
          />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;" for="title">Title</label>
          <input
            type="text"
            id="title"
            value="${this._config.title || 'Recipe Extractor'}"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
            aria-label="Card title"
          />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;" for="button_text">Button Text</label>
          <input
            type="text"
            id="button_text"
            value="${this._config.button_text || 'Extract to List'}"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
            aria-label="Button text"
          />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;" for="placeholder">Placeholder Text</label>
          <input
            type="text"
            id="placeholder"
            value="${this._config.placeholder || 'Enter recipe URL...'}"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
            aria-label="Input placeholder text"
          />
        </div>
      </div>
    `;

    this.content = true;
    this.setupEditorListeners();
  }

  /**
   * Set up event listeners for editor inputs to emit config changes
   */
  setupEditorListeners() {
    const entity = this.querySelector('#entity');
    const title = this.querySelector('#title');
    const buttonText = this.querySelector('#button_text');
    const placeholder = this.querySelector('#placeholder');

    [entity, title, buttonText, placeholder].forEach((input) => {
      input.addEventListener('input', () => {
        this._config = {
          ...this._config,
          entity: entity.value,
          title: title.value,
          button_text: buttonText.value,
          placeholder: placeholder.value,
        };
        this.dispatchEvent(
          new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
          })
        );
      });
    });
  }
}

// Register the custom elements
if (!customElements.get('recipe-extractor-card')) {
  customElements.define('recipe-extractor-card', RecipeExtractorCard);
  console.info('%c RECIPE-EXTRACTOR-CARD %c Registered', 'color: white; background: green; font-weight: 700;', 'color: green; font-weight: 700;');
}

if (!customElements.get('recipe-extractor-card-editor')) {
  customElements.define('recipe-extractor-card-editor', RecipeExtractorCardEditor);
}

// Register with custom cards registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'recipe-extractor-card',
  name: 'Recipe Extractor Card',
  description: 'A card to extract recipes from URLs and add ingredients to a todo list',
  preview: true,
  documentationURL: 'https://github.com/tristan-schwoerer/recipe-extractor-card',
});

console.info('Recipe Extractor Card loaded and ready');
