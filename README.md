# Recipe Extractor Card

A custom Lovelace card for Home Assistant that provides a simple UI to extract recipes from URLs and add ingredients to a todo list.

This card works with the [Recipe Extractor](https://github.com/tristan-schwoerer/recipe_extractor) integration.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

## Features

- Clean, simple input field for recipe URLs
- One-click extraction button
- Real-time status messages (success, error, loading)
- Automatic URL validation
- Press Enter in the input field to trigger extraction
- Respects Home Assistant theme colors
- Visual configuration editor

## Prerequisites

You must have the [Recipe Extractor integration](https://github.com/tristan-schwoerer/recipe_extractor) installed and configured before using this card.

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
4. Configure the card options:
   - **Entity**: Your todo list entity (required)
   - **Title**: Card title (optional, default: "Recipe Extractor")
   - **Button Text**: Text for the button (optional, default: "Extract to List")
   - **Placeholder**: Input placeholder text (optional, default: "Enter recipe URL...")
5. Click **"Save"**

### Add via YAML

```yaml
type: custom:recipe-extractor-card
entity: todo.shopping_list  # Required: Your todo list entity
title: Recipe Extractor  # Optional
button_text: Extract to List  # Optional
placeholder: Enter recipe URL...  # Optional
```

## Configuration Options

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `type` | string | Yes | - | Must be `custom:recipe-extractor-card` |
| `entity` | string | Yes | - | Entity ID of your todo list (e.g., `todo.shopping_list`) |
| `title` | string | No | `Recipe Extractor` | Title displayed at the top of the card |
| `button_text` | string | No | `Extract to List` | Text shown on the extraction button |
| `placeholder` | string | No | `Enter recipe URL...` | Placeholder text in the URL input field |

## Screenshots

### Card Interface
![Recipe Extractor Card](https://via.placeholder.com/600x300?text=Add+Screenshot+Here)

### Visual Editor
![Configuration Editor](https://via.placeholder.com/600x300?text=Add+Screenshot+Here)

## How It Works

1. Enter a recipe URL from a supported website
2. Click "Extract to List" or press Enter
3. The card calls the `recipe_extractor.extract_to_list` service
4. Ingredients are automatically extracted and added to your todo list
5. Status messages show the progress and result

## Supported Recipe Websites

The card supports any website that the Recipe Extractor integration can parse. See the [Recipe Extractor documentation](https://github.com/tristan-schwoerer/recipe_extractor#supported-websites) for more information.

## Troubleshooting

### Card doesn't appear in the card picker
- Make sure you've added the resource correctly
- Clear your browser cache (Ctrl+F5)
- Check the browser console (F12) for errors

### "Custom element not found" error
- Verify the resource URL is correct: `/local/recipe-extractor-card.js`
- Make sure the resource type is "JavaScript Module"
- Check that the file exists in your `config/www` folder

### "Failed to extract recipe" error
- Verify the Recipe Extractor integration is installed and configured
- Check that your todo list entity exists
- Ensure you have an API key configured in the integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Credits

Part of the [Recipe Extractor](https://github.com/tristan-schwoerer/recipe_extractor) project.
