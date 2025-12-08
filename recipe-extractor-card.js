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
            />
          </div>
          <div class="controls-group">
            <div class="button-row">
              <button class="button" id="extractButton">Extract</button>
              <input
                type="number"
                class="servings-input"
                id="targetServings"
                placeholder="Portions"
                min="0.1"
                max="100"
                step="0.1"
              />
              <button class="button" id="addToListButton" disabled>Add to List</button>
            </div>
            <button class="button accent" id="extractAndAddButton">Extract + Add</button>
          </div>
          <div id="statusMessage" class="status-message hidden"></div>
          <div id="recipeInfo" class="recipe-info hidden">
            <strong id="recipeTitle"></strong>
            <span id="recipeDetails"></span>
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

      // Basic URL validation
      try {
        new URL(url);
      } catch (e) {
        this.showStatus('Please enter a valid URL', 'error');
        return;
      }

      extractButton.disabled = true;
      extractAndAddButton.disabled = true;
      recipeInfo.classList.add('hidden');
      this.showStatus('Checking recipe format...', 'info');

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

        // Show extraction method immediately
        const extractionMethod = data.extraction_method === 'json-ld' 
          ? 'Parsing from JSON-LD' 
          : 'Converting using AI';
        this.showStatus(`${extractionMethod}...`, 'info');

        // Store extracted recipe
        this.extractedRecipe = data;
        this.currentUrl = url;

        // Show recipe info
        this.showRecipeInfo(data);
        
        // Enable "Add to List" button
        addToListButton.disabled = false;
        
        // Show success status
        this.showStatus(`Recipe extracted! Adjust portions if needed.`, 'success');

        // Clear success message after 3 seconds
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, 3000);
      } catch (error) {
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
        recipeInfo.classList.add('hidden');
        this.extractedRecipe = null;
        this.currentUrl = null;
        addToListButton.disabled = true;

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

    // Step 3: Extract and Add in one click
    extractAndAddButton.addEventListener('click', async () => {
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
      this.showStatus('Checking recipe format...', 'info');

      try {
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

        if (data && data.error) {
          this.showStatus('Error: ' + data.error, 'error');
          return;
        }

        // Show extraction method immediately
        const extractionMethod = data.extraction_method === 'json-ld' 
          ? 'Parsing from JSON-LD' 
          : 'Converting using AI';
        this.showStatus(`${extractionMethod}...`, 'info');

        const itemsAdded = data?.items_added || 0;
        if (itemsAdded > 0) {
          this.showStatus(`Added ${itemsAdded} ingredients to list!`, 'success');
        } else {
          this.showStatus('No ingredients to add.', 'error');
        }

        // Clear form
        input.value = '';
        targetServingsInput.value = '';
        recipeInfo.classList.add('hidden');
        this.extractedRecipe = null;
        this.currentUrl = null;

        // Clear message after 5 seconds
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, 5000);
      } catch (error) {
        console.error('Error in extract and add:', error);
        this.showStatus('Failed to extract and add: ' + error.message, 'error');
      } finally {
        extractButton.disabled = false;
        addToListButton.disabled = true;
        extractAndAddButton.disabled = false;
      }
    });
  }

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
      if (!targetServingsInput.value) {
        targetServingsInput.value = recipeData.servings;
      }
    }

    recipeDetails.textContent = detailsText;
    recipeInfo.classList.remove('hidden');
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
