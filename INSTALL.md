# Installation Guide

## Quick Install (Recommended)

### Via Foundry VTT

1. Open Foundry VTT
2. Go to "Add-on Modules" tab
3. Click "Install Module"
4. Paste the manifest URL: `https://github.com/Goldendice1/Summons-for-PF1e`
5. Click "Install"
6. Enable the module in your world

### Manual Installation

1. Download the latest release from the releases page
2. Extract the zip file
3. Copy the `Summons-for-PF1e` folder to your Foundry `Data/modules` directory
4. Restart Foundry VTT
5. Enable the module in your world under "Manage Modules"

## First-Time Setup

### Required Dependencies

Before using this module, ensure you have:

1. **Foundry VTT v13+**: This module requires Foundry v13 or higher
2. **Pathfinder 1e System**: Install the PF1e game system
3. **Portal Module**: Install and enable the Portal module (required for creature placement)

### Recommended Compendiums

You'll need a compendium containing summonable creatures. Recommended options:

- **Summons for PF1e**: The module is designed to work with this compendium pack
- Any custom compendium with Actor documents

### Initial Configuration

1. Navigate to Settings → Module Settings → Summon Monster for PF1e
2. Configure the following:

   **Pack Sources** (Required):

   - Enter comma-separated package names containing your summons
   - Default: `summons-for-pf1e`
   - Example: `summons-for-pf1e, my-custom-summons`

   **Template Pack Source** (Required):

   - Enter the pack containing templates (Celestial, Fiendish, etc.)
   - Default: `summons-for-pf1e.summon-templates`

   **Destination Folder**:

   - Name of the folder where summoned actors will be stored
   - Default: `Summons`
   - The folder will be auto-created if it doesn't exist

   **Feature Toggles**:

   - Enable/disable optional features:
     - Augment Summoning
     - Extend Metamagic
     - Reach Metamagic
     - Conjured Armor
     - Harrowed Summoning

3. Click "Save Changes"

## Verification

To verify the module is working:

1. Open a character sheet with spellcasting abilities
2. Look for a "Summon" button in the sheet header
3. Click the button to open the summon dialog
4. If the dialog appears, installation is successful!

## Troubleshooting

### "No token chosen as summoner" Error

- **Cause**: No token is selected or placed on the scene
- **Solution**: Select your character's token on the canvas before opening the summon dialog

### "Portal module required" Error

- **Cause**: Portal module is not installed or enabled
- **Solution**: Install and enable the Portal module from Foundry's module browser

### Empty Summon Lists

- **Cause**: Pack sources are not configured correctly
- **Solution**:
  1. Check that the compendium packs exist in your world
  2. Verify the pack names in module settings
  3. Ensure the packs contain Actor documents

### Templates Not Working

- **Cause**: Template pack source is incorrect
- **Solution**: Verify the template pack exists and contains the required templates

### Duration Tracking Not Working

- **Cause**: Foundry v13 world time may not be properly initialized
- **Solution**: Ensure you're running Foundry v13+ and that world time is enabled

## Getting Help

If you encounter issues:

1. Check the browser console (F12) for error messages
2. Verify all dependencies are installed and up-to-date
3. Review this guide and the README
4. Check existing issues on GitHub
5. Create a new issue with:
   - Foundry VTT version
   - PF1e system version
   - Module version
   - Console error messages
   - Steps to reproduce

## Next Steps

Once installed, check out:

- [README.md](README.md) - Usage guide and features
- [USAGE.md](USAGE.md) - Detailed usage examples
- [API.md](API.md) - API documentation for macro creators
