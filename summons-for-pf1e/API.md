# API Documentation

## Overview

The Summons for PF1e module exposes an API that can be used by macros, other modules, or scripts. The API is accessible via `game.modules.get("summons-for-pf1e").api` or the global `window.SummonMonster` object.

## Main API

### SummonMonster.open(actor)

Opens the summon dialog for the specified actor.

**Parameters:**

- `actor` (Actor|null): The actor to use as summoner. If null, uses selected token or player's character.

**Returns:** void

**Examples:**

```javascript
// Open for selected token or player's character
SummonMonster.open();

// Open for specific actor
const wizard = game.actors.getName("Gandalf");
SummonMonster.open(wizard);

// Open for actor by ID
const actor = game.actors.get("actorId123");
SummonMonster.open(actor);
```

**Errors:**

- Throws warning if no valid summoner token is found
- Throws warning if actor has no token on canvas

## Module API

Access via: `game.modules.get("summons-for-pf1e").api`

### openSummonDialog(actor)

Same as `SummonMonster.open(actor)`. Opens the summon dialog.

### SummonDialog

Direct access to the SummonDialog class for advanced usage.

**Constructor:**

```javascript
new SummonDialog(summonerActor, summonerToken, options);
```

**Parameters:**

- `summonerActor` (Actor): The actor performing the summon
- `summonerToken` (Token): The token of the summoner
- `options` (Object): Optional Dialog options

**Example:**

```javascript
const actor = game.actors.getName("Wizard");
const token = canvas.tokens.placeables.find((t) => t.actor.id === actor.id);
const dialog = new game.modules.get("summons-for-pf1e").api.SummonDialog(
  actor,
  token
);
dialog.render(true);
```

### getConfig()

Returns the current module configuration.

**Returns:** Object with configuration settings

**Example:**

```javascript
const config = game.modules.get("summons-for-pf1e").api.getConfig();
console.log(config.enableAugmentSummoning); // true or false
```

**Configuration Object:**

```javascript
{
    packSource: Array<string>,           // Pack sources for summons
    packTemplateSource: string,          // Template pack source
    destinationFolder: string,           // Destination folder name
    useUserLinkedActorOnly: boolean,     // Restrict to linked actor
    enableAugmentSummoning: boolean,     // Show augment option
    enableExtendMetamagic: boolean,      // Show extend option
    enableReachMetamagic: boolean,       // Show reach option
    enableConjuredArmor: boolean,        // Show conjured armor option
    enableHarrowedSummoning: boolean     // Show harrowed option
}
```

## Internal Classes

These are available but generally shouldn't be used directly unless you're extending the module.

### SummonManager

Manages the summoning process including actor creation, buff application, and spawning.

**Constructor:**

```javascript
new SummonManager(summonerActor, summonerToken, config);
```

### ExpirationTracker

Handles duration tracking and cleanup for summons.

**Methods:**

- `ExpirationTracker.initialize()` - Sets up hooks for tracking
- Internal methods for managing expirations

## Hooks

The module uses several Foundry hooks that you can listen to:

### Custom Hooks

Currently, the module doesn't emit custom hooks, but this may be added in future versions.

### Foundry Hooks Used

The module listens to these hooks (you can hook into them as well):

- `updateCombat` - Combat expiration tracking
- `updateWorldTime` - Out-of-combat expiration tracking
- `deleteCombat` - Convert combat durations to world time
- `renderChatMessage` - Add delete buttons to expiration messages
- `getActorSheetHeaderButtons` - Add summon button to character sheets

## Advanced Usage

### Custom Summon Button

Add a summon button to a custom sheet:

```javascript
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (sheet.actor.type === "character") {
    buttons.unshift({
      label: "Quick Summon",
      class: "summon-quick",
      icon: "fas fa-magic",
      onclick: () => {
        SummonMonster.open(sheet.actor);
      },
    });
  }
});
```

### Programmatic Summoning

For completely automated summoning (bypassing the dialog):

```javascript
// This requires accessing internal APIs and is not recommended
// but is possible for advanced users

const { SummonManager } = game.modules.get("summons-for-pf1e").api;

// You would need to construct the HTML form data manually
// and pass it to the manager's importMonster method
// This is complex and not officially supported
```

### Custom Expiration Handling

Listen for summon expirations:

```javascript
Hooks.on("renderChatMessage", (message, html, data) => {
  if (html.find(".summon-delete-placeholder").length > 0) {
    console.log("A summon has expired!");
    // Your custom logic here
  }
});
```

### Modifying Default Settings

Override default settings at runtime (persists for session):

```javascript
// Not recommended, but possible
await game.settings.set("summons-for-pf1e", "enableAugmentSummoning", true);
```

## Flag Structure

The module uses actor flags for tracking summons. This is internal but documented for reference.

### Summon Expiration Flags

Stored on summoner actor: `actor.getFlag("world", "summonExpirations")`

**Structure:**

```javascript
[
    {
        mode: "combat" | "calendar",  // Tracking mode
        actorId: string,               // Summoned actor ID
        tokenId: string,               // Summoned token ID
        expireRound?: number,          // (combat mode) Round to expire
        combatId?: string,             // (combat mode) Combat ID
        expireTime?: number,           // (calendar mode) World time to expire
        created: number                // Timestamp of creation
    },
    // ... more expirations
]
```

**Example Access:**

```javascript
const actor = game.actors.getName("Wizard");
const expirations = await actor.getFlag("world", "summonExpirations");
console.log(`Active summons: ${expirations.length}`);
```

## Compatibility

### Required APIs

The module requires:

- Foundry VTT v13+ API
- PF1e system data structure
- Portal module API

### System Compatibility

Currently designed for PF1e. Adapting for other systems would require:

1. Modifying spellbook detection logic
2. Adjusting buff application (system-specific)
3. Updating stat calculations (HD, resistances, etc.)

## Error Handling

All API functions include error handling and will:

- Log errors to console with `[SummonMonster]` prefix
- Show user-friendly notifications via `ui.notifications`
- Fail gracefully without breaking other functionality

## Future API Additions

Planned for future versions:

- Custom hooks for summon events
- Helper functions for common operations
- Settings API for module integration
- Template registration API

## Support

For API questions:

1. Check this documentation
2. Review the source code in `scripts/`
3. Open an issue on GitHub
4. Check existing issues for similar questions

## Examples Repository

See the `/examples` folder (if available) for:

- Complete macro examples
- Integration examples
- Custom dialog examples
- Advanced usage patterns
