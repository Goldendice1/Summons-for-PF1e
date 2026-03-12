# Summons for PF1e

A comprehensive Foundry VTT module for automating creature summoning in the Pathfinder 1e system.

## Features

- **Easy Summoning Interface**: Dialog-based summoning with intuitive options
- **Portal Integration**: Visual creature placement using the Portal module
- **Automatic Duration Tracking**: Tracks summon durations in both combat and exploration modes
- **Combat Integration**: Automatically adds summoned creatures to initiative tracker
- **Template Support**: Apply Celestial, Fiendish, Entropic, or Resolute templates
- **Buff Options**:
  - Augment Summoning feat
  - Harrowed Summoning
  - Conjured Armor (for psychic casters)
  - Extend and Reach metamagic
- **Automatic Cleanup**: Delete buttons and automatic expiration handling
- **Foundry v13 Compatible**: Uses core world time system for duration tracking

## Requirements

- Foundry VTT v13 or higher
- Pathfinder 1e system
- Portal module (required)
- A compendium pack with summonable creatures

## Installation

**Via Foundry's module installer (recommended):**

1. In Foundry, go to **Add-on Modules → Install Module**
2. Paste the manifest URL:
   ```
   https://github.com/Goldendice1/Summons-for-PF1e/releases/latest/download/module.json
   ```
3. Click **Install**, then enable the module in your world

**Manual install:**

1. Download the zip from the [latest release](https://github.com/Goldendice1/Summons-for-PF1e/releases/latest)
2. Extract to your Foundry `modules` folder
3. Enable the module in your world

## Releases

Releases are published on the [GitHub Releases page](https://github.com/Goldendice1/Summons-for-PF1e/releases). Each release attaches a versioned zip and a `module.json` manifest. Foundry's built-in updater will detect new releases automatically via the manifest URL above.

## Usage

### Basic Usage

1. Select your summoner token on the canvas
2. Click the "Summon" button on the character sheet header, or use `SummonMonster.open()` in a macro
3. Configure your summon options:
   - Choose spellbook and caster level
   - Select compendium source
   - Pick creature to summon
   - Choose template (if applicable)
   - Set number to summon
   - Enable buffs and metamagic as needed
4. Click "Summon" and place creatures using Portal's interface

### For GMs

GMs can summon creatures using any selected token. An option to give ownership to the token's owner is available.

### For Players

Players can summon using their assigned character. The character must have a token on the current scene.

### Macro Usage

You can create a macro to open the summon dialog:

```javascript
SummonMonster.open();
```

Or with a specific actor:

```javascript
const actor = game.actors.getName("Character Name");
SummonMonster.open(actor);
```

## Configuration

Module settings are available in the module configuration menu:

- **Summon Pack Sources**: Comma-separated list of packages containing summon actors
- **Template Pack Source**: Pack containing summon templates
- **Destination Folder**: Folder where summoned actors are stored
- **Use User Linked Actor Only**: Restrict players to their assigned character
- **Enable Features**: Toggle individual features (Augment Summoning, Metamagic options, etc.)

## Duration Tracking

The module automatically tracks summon durations:

- **In Combat**: Durations are tracked by round
- **Out of Combat**: Durations use Foundry's world time system
- **Combat Transitions**: Durations are automatically converted when combat ends

When a summon expires, a chat message is posted with a delete button to clean up the creature.

## For Developers

### Cutting a Release

Releases are driven by git tags. To publish a new version:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The [release workflow](.github/workflows/release.yml) will automatically:
1. Stamp the tag's version number and a versioned download URL into `module.json`
2. Build a zip containing all module files (scripts, styles, lang, packs, etc.)
3. Create a GitHub Release with the zip and `module.json` attached as assets

Foundry users will see the update the next time they check for module updates.

### Running Tests

```bash
npm ci
npm test
```

## Credits

Based on the original Summon Monster macro for PF1e.

Converted to a module with enhanced features and v13 compatibility.

## License

[Add your license here]

## Support

For issues and feature requests, please visit the GitHub repository.
