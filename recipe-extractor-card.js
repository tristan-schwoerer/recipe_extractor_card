class RecipeExtractorCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.extractedRecipe = null;
  }

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
  }

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
        .url-input {
          width: 100%;
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
        .extract-button {
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary-color, white);
          background-color: var(--primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .extract-button:hover {
          background-color: var(--primary-color);
          filter: brightness(1.1);
        }
        .extract-button:active {
          filter: brightness(0.9);
        }
        .extract-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .status-message {
          margin-top: 12px;
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
        .servings-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 12px;
          padding: 12px;
          background-color: var(--secondary-background-color);
          border-radius: 4px;
        }
        .servings-info {
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .servings-input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .servings-input-group label {
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .servings-input {
          width: 80px;
          padding: 8px;
          font-size: 14px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background-color: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .add-to-list-button {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary-color, white);
          background-color: var(--primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .add-to-list-button:hover {
          background-color: var(--primary-color);
          filter: brightness(1.1);
        }
        .add-to-list-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
      <ha-card>
        <div class="card-header">${title}</div>
        <div class="input-container">
          <input
            type="url"
            class="url-input"
            placeholder="${placeholder}"
            id="recipeUrl"
          />
          <button class="extract-button" id="extractButton">
            Extract Recipe
          </button>
          <div id="statusMessage" class="status-message hidden"></div>
          <div id="servingsContainer" class="servings-container hidden">
            <div class="servings-info">
              <strong id="recipeTitle"></strong>
            </div>
            <div class="servings-info" id="originalServings"></div>
            <div class="servings-input-group">
              <label for="targetServings">Adjust servings:</label>
              <input
                type="number"
                class="servings-input"
                id="targetServings"
                min="1"
                max="100"
              />
            </div>
            <button class="add-to-list-button" id="addToListButton">
              ${buttonText}
            </button>
          </div>
        </div>
      </ha-card>
    `;

    this.content = true;
    this.setupListeners();
  }

  setupListeners() {
    const extractButton = this.shadowRoot.getElementById('extractButton');
    const addToListButton = this.shadowRoot.getElementById('addToListButton');
    const input = this.shadowRoot.getElementById('recipeUrl');
    const statusMessage = this.shadowRoot.getElementById('statusMessage');
    const servingsContainer = this.shadowRoot.getElementById('servingsContainer');

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

      // Basic URL validation
      try {
        new URL(url);
      } catch (e) {
        this.showStatus('Please enter a valid URL', 'error');
        return;
      }

      extractButton.disabled = true;
      servingsContainer.classList.add('hidden');
      this.showStatus('Extracting recipe...', 'info');

      try {
        // Call the extract service (not extract_to_list)
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

        // Show servings adjustment UI
        this.showServingsAdjustment(data);
        this.showStatus('Recipe extracted! Adjust servings if needed.', 'success');

        // Clear success message after 3 seconds
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, 3000);
      } catch (error) {
        console.error('Error extracting recipe:', error);
        this.showStatus('Failed to extract recipe: ' + error.message, 'error');
      } finally {
        extractButton.disabled = false;
      }
    });

    // Step 2: Add to list with adjusted servings
    addToListButton.addEventListener('click', async () => {
      if (!this.extractedRecipe || !this.currentUrl) {
        this.showStatus('No recipe extracted', 'error');
        return;
      }

      const targetServingsInput = this.shadowRoot.getElementById('targetServings');
      const targetServings = parseInt(targetServingsInput.value);

      if (targetServings && targetServings <= 0) {
        this.showStatus('Servings must be a positive number', 'error');
        return;
      }

      addToListButton.disabled = true;
      this.showStatus('Adding ingredients to list...', 'info');

      try {
        const serviceData = {
          url: this.currentUrl,
          todo_entity: this.config.entity,
        };

        // Only add target_servings if it's different from original
        if (targetServings && targetServings !== this.extractedRecipe.servings) {
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
        servingsContainer.classList.add('hidden');
        this.extractedRecipe = null;
        this.currentUrl = null;

        // Clear message after 5 seconds
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, 5000);
      } catch (error) {
        console.error('Error adding to list:', error);
        this.showStatus('Failed to add to list: ' + error.message, 'error');
      } finally {
        addToListButton.disabled = false;
      }
    });
  }

  showServingsAdjustment(recipeData) {
    const servingsContainer = this.shadowRoot.getElementById('servingsContainer');
    const recipeTitle = this.shadowRoot.getElementById('recipeTitle');
    const originalServings = this.shadowRoot.getElementById('originalServings');
    const targetServingsInput = this.shadowRoot.getElementById('targetServings');

    // Set recipe title
    recipeTitle.textContent = recipeData.title || 'Recipe';

    // Set servings information
    if (recipeData.servings) {
      originalServings.textContent = `Original recipe: ${recipeData.servings} servings`;
      targetServingsInput.value = recipeData.servings;
    } else {
      originalServings.textContent = 'Original servings not specified';
      targetServingsInput.value = '';
      targetServingsInput.placeholder = 'N/A';
    }

    // Show ingredient count
    const ingredientCount = recipeData.ingredients?.length || 0;
    originalServings.textContent += ` • ${ingredientCount} ingredients`;

    servingsContainer.classList.remove('hidden');
  }

  showStatus(message, type) {
    const statusMessage = this.shadowRoot.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.classList.remove('hidden');
  }

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

  render() {
    this.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Entity (Todo List)*</label>
          <input
            type="text"
            id="entity"
            value="${this._config.entity || ''}"
            placeholder="todo.shopping_list"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Title</label>
          <input
            type="text"
            id="title"
            value="${this._config.title || 'Recipe Extractor'}"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Button Text</label>
          <input
            type="text"
            id="button_text"
            value="${this._config.button_text || 'Extract to List'}"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px;">Placeholder Text</label>
          <input
            type="text"
            id="placeholder"
            value="${this._config.placeholder || 'Enter recipe URL...'}"
            style="width: 100%; padding: 8px; box-sizing: border-box;"
          />
        </div>
      </div>
    `;

    this.content = true;
    this.setupEditorListeners();
  }

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
