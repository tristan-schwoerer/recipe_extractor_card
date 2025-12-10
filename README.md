# Recipe Extractor Card

A custom Lovelace card for Home Assistant that extracts recipe ingredients from URLs and adds them to your shopping list with optional portion scaling.

This card provides a user-friendly interface for the [Recipe Extractor](https://github.com/tristan-schwoerer/recipe_extractor) integration, offering both a two-step workflow (extract, review, then add) and a one-click workflow (extract and add immediately).

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

## Features

- **Two-step workflow**: Extract recipe first, then add to list with adjusted portions
- **One-click workflow**: Extract and add ingredients in a single action
- **Portion scaling**: Adjust servings before adding ingredients to your list
- **Smart extraction detection**: Shows whether recipe uses fast JSON-LD parsing (⚡) or AI extraction (🤖)
- **Real-time progress updates**: Status messages show extraction method and progress
- **URL validation**: Blocks invalid URLs and internal/private IP addresses for security
- **Recipe preview**: Displays title, ingredient count, and original servings after extraction
- **Keyboard support**: Press Enter in the URL input to start extraction
- **Theme integration**: Respects Home Assistant theme colors
- **Visual configuration editor**: Easy setup through the UI
- **Automatic timeout**: 30-second timeout prevents hanging extractions

## Prerequisites

You must have the [Recipe Extractor integration](https://github.com/tristan-schwoerer/recipe_extractor) installed and configured before using this card. The integration requires:

- A Google Gemini API key (for AI extraction)
- A Home Assistant todo list entity (e.g., `todo.shopping_list`, Google Keep, etc.)

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=tristan-schwoerer&repository=recipe-extractor-card&category=lovelace)

1. Open HACS in Home Assistant
2. Go to "Frontend"
3. Click the three dots in the top right corner
4. Select "Custom repositories"
5. Add this repository URL: `https://github.com/tristan-schwoerer/recipe-extractor-card`
6. Select category: "Lovelace"
7. Click "Add"
8. Search for "Recipe Extractor Card" and install it
9. Refresh your browser (Ctrl+F5 or Cmd+Shift+R)

### Manual Installation

1. Download `recipe-extractor-card.js` from the [latest release](https://github.com/tristan-schwoerer/recipe-extractor-card/releases)
2. Copy it to your `config/www` folder
3. Add the resource in Home Assistant:
   - Go to **Settings** → **Dashboards** → **Resources**
   - Click **"+ ADD RESOURCE"**
   - URL: `/local/recipe-extractor-card.js`
   - Resource type: **JavaScript Module**
4. Refresh your browser

## Usage

### Add via UI

1. Edit your dashboard
2. Click **"+ ADD CARD"**
3. Search for **"Recipe Extractor Card"**
3. Configure the card options:
   - **Entity**: Your todo list entity (required, e.g., `todo.shopping_list`)
   - **Title**: Card title (optional, default: "Recipe Extractor")
   - **Button Text**: Legacy option, not currently used (optional, default: "Extract to List")
   - **Placeholder**: Input placeholder text (optional, default: "Enter recipe URL...")
5. Click **"Save"**

### Add via YAML

```yaml
type: custom:recipe-extractor-card
entity: todo.shopping_list  # Required: Your todo list entity
title: Recipe Extractor  # Optional, default: "Recipe Extractor"
button_text: Extract to List  # Optional (legacy, not used), default: "Extract to List"
placeholder: Enter recipe URL...  # Optional, default: "Enter recipe URL..."
```

## Card Layout

The card displays:

1. **URL Input Field**: Enter the recipe website URL here
2. **Extract Button**: Extracts recipe without adding to list
3. **Portions Field**: Number input to scale recipe servings
4. **Add to List Button**: Adds extracted recipe to your todo list (disabled until extraction completes)
5. **Extract + Add Button**: One-click extraction and addition to list
6. **Status Messages**: Real-time feedback with color-coded messages:
   - Blue (info): "Checking recipe format...", "⚡ Fast parsing (JSON-LD found)", "🤖 AI extraction (may take ~10s)"
   - Green (success): "Recipe extracted! Adjust portions if needed.", "Added X ingredients to list!"
   - Red (error): Various error messages
7. **Recipe Info Panel**: Shows after extraction with:
   - Recipe title with extraction method icon (⚡ or 🤖)
   - Ingredient count
   - Extraction method label
   - Original servings count

## Configuration Options

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `type` | string | Yes | - | Must be `custom:recipe-extractor-card` |
| `entity` | string | Yes | - | Entity ID of your todo list (e.g., `todo.shopping_list`) |
| `title` | string | No | `Recipe Extractor` | Title displayed at the top of the card |
| `button_text` | string | No | `Extract to List` | Text shown on the one-click extraction button (note: currently not used due to two-button layout) |
| `placeholder` | string | No | `Enter recipe URL...` | Placeholder text in the URL input field |

## Screenshots

### Card Interface
![Recipe Extractor Card](https://via.placeholder.com/600x300?text=Add+Screenshot+Here)

### Visual Editor
![Configuration Editor](https://via.placeholder.com/600x300?text=Add+Screenshot+Here)

## How It Works

The card offers two workflows:

### Two-Step Workflow (Extract, then Add)

1. Enter a recipe URL from a supported website
2. Click **"Extract"** or press Enter
3. The card calls the `recipe_extractor.extract` service
4. Status messages indicate if the recipe uses fast JSON-LD parsing (⚡) or AI extraction (🤖)
5. Recipe information is displayed: title, ingredient count, and original servings
6. Optionally adjust the **"Portions"** field to scale ingredients
7. Click **"Add to List"** to add ingredients to your todo list
8. The card calls the `recipe_extractor.add_to_list` service with the scaled recipe

### One-Click Workflow (Extract + Add)

1. Enter a recipe URL from a supported website
2. Optionally set the **"Portions"** field to scale the recipe
3. Click **"Extract + Add"** to extract and add ingredients in one step
4. The card calls the `recipe_extractor.extract_to_list` service
5. Ingredients are automatically added to your todo list
6. Status messages show the progress and result

### URL Validation

The card validates URLs for security:
- Only `http://` and `https://` protocols are allowed
- Blocks localhost and internal IP addresses (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Prevents link-local addresses (169.254.x.x)

### Timeout Protection

- Extraction automatically times out after 30 seconds
- Prevents the card from hanging on problematic websites

### Portion Scaling

- The **Portions** field accepts decimal values (e.g., 2.5 servings)
- Valid range: 0.1 to 100 servings
- If the recipe specifies original servings, the field is pre-filled with that value
- Ingredients are scaled proportionally based on the ratio between target and original servings
- Scaling only works if the recipe includes the original serving count
- If no portions are specified, ingredients are added as-is from the original recipe

## Services Used

The card interacts with three services from the Recipe Extractor integration:

### `recipe_extractor.extract`
- Called by the "Extract" button
- Returns recipe data without adding to todo list
- Response includes: title, ingredients, servings, extraction method
- Triggers Home Assistant events: `recipe_extractor_extraction_started` and `recipe_extractor_method_detected`

### `recipe_extractor.add_to_list`
- Called by the "Add to List" button
- Takes pre-extracted recipe data
- Optionally scales ingredients based on `target_servings`
- Returns number of items added to the list

### `recipe_extractor.extract_to_list`
- Called by the "Extract + Add" button
- Combines extraction and list addition in one step
- Optionally scales ingredients based on `target_servings`
- Returns number of items added to the list

## Supported Recipe Websites

The card supports any website that the Recipe Extractor integration can parse. The integration uses two extraction methods:

- **JSON-LD parsing (⚡)**: Fast, instant extraction from structured data
- **AI extraction (🤖)**: Uses Google Gemini AI for sites without structured data (typically takes 5-15 seconds)

See the [Recipe Extractor documentation](https://github.com/tristan-schwoerer/recipe_extractor#supported-websites) for more information.

## Technical Details

### Event Listeners

The card subscribes to Home Assistant events to provide real-time feedback:

- `recipe_extractor_extraction_started`: Fired when extraction begins
- `recipe_extractor_method_detected`: Fired when the extraction method is determined (JSON-LD or AI)

These events are automatically cleaned up when the card is removed from the DOM to prevent memory leaks.

### Security Features

- **URL Protocol Validation**: Only allows `http://` and `https://` protocols
- **Private IP Blocking**: Prevents extraction from:
  - Localhost (127.0.0.0/8)
  - Private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  - Link-local addresses (169.254.0.0/16)
- **Input Sanitization**: All user inputs are validated before service calls

### Message Timing

- Info messages (blue): Display for 3 seconds
- Success messages (green): Display for 5 seconds
- Error messages (red): Remain visible until next action

### Card Size

The card reports a size of 3 grid rows to Home Assistant for layout purposes.

## Troubleshooting

### Card doesn't appear in the card picker
- Make sure you've added the resource correctly
- Clear your browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check the browser console (F12) for errors
- Look for `RECIPE-EXTRACTOR-CARD Registered` in the console

### "Custom element not found" error
- Verify the resource URL is correct: `/local/recipe-extractor-card.js`
- Make sure the resource type is "JavaScript Module"
- Check that the file exists in your `config/www` folder

### "Failed to extract recipe" error
- Verify the Recipe Extractor integration is installed and configured
- Check that your todo list entity exists and is accessible
- Ensure you have an API key configured in the integration
- Check Home Assistant logs for detailed error messages

### Extraction times out after 30 seconds
- Some websites may be slow or difficult to parse
- AI extraction (🤖) typically takes 5-15 seconds
- JSON-LD parsing (⚡) is usually instant
- Try the URL again or check if the website is accessible

### URL validation errors
- "Only HTTP/HTTPS URLs are allowed": Check the URL starts with http:// or https://
- "Internal/local URLs are not allowed": The card blocks localhost and private IP addresses for security
- "Please enter a valid URL": Check the URL format is correct

### "Add to List" button is disabled
- You must click "Extract" first to enable the "Add to List" button
- Or use "Extract + Add" to do both steps at once

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Credits

Part of the [Recipe Extractor](https://github.com/tristan-schwoerer/recipe_extractor) project.
