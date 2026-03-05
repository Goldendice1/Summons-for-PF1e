# Usage Guide

## Table of Contents
- [Basic Summoning](#basic-summoning)
- [Advanced Options](#advanced-options)
- [Combat Integration](#combat-integration)
- [Duration Tracking](#duration-tracking)
- [Macro Usage](#macro-usage)
- [Tips & Tricks](#tips--tricks)

## Basic Summoning

### Step-by-Step Process

1. **Select Your Summoner**
   - Place your character's token on the scene
   - Select the token (click on it)

2. **Open the Summon Dialog**
   - Method 1: Click the "Summon" button on the character sheet header
   - Method 2: Use a macro: `SummonMonster.open()`
   - Method 3 (GM): Select any token and use the macro

3. **Configure Your Summon**
   - **Spellbook**: Choose which spellcasting class to use
     - Shows current caster level with conjuration bonuses
   - **CL Override**: Optional override for scrolls or special situations
   - **Summon From**: Select the compendium containing your creatures
   - **Summon**: Choose the specific creature
   - **Template**: Choose Celestial, Fiendish, Entropic, or Resolute (if applicable)
   - **Number to Summon**: Enter a number or dice formula (e.g., `1d4+1`)

4. **Place Your Summons**
   - Click locations on the map within range
   - Portal visualization shows valid placement areas
   - Repeat for multiple summons

5. **Done!**
   - Summons appear on the map
   - If in combat, they're added to initiative
   - Duration tracking begins automatically

## Advanced Options

### Augment Summoning Feat
- Adds +4 STR and +4 CON to summoned creatures
- Automatically updates the creature's name to include "(Augmented)"
- Must be enabled in module settings to appear

**When to Use**: Always enable if your character has the Augment Summoning feat

### Metamagic Options

#### Extend Metamagic
- Doubles the duration of the summon
- Useful for exploration or long encounters

**Example**: A spell that normally lasts 5 rounds will last 10 rounds

#### Reach Metamagic
- Increases summon range
- Normal: 25 ft + 5 ft/2 levels
- Reach: 100 ft + 10 ft/level

**When to Use**: Summoning at long distance or avoiding opportunity attacks

### Conjured Armor (Psychic Casters)
- Available only for characters with Psychic spellcasting
- Grants deflection bonus to AC:
  - Levels 1-7: +2
  - Levels 8-14: +3
  - Levels 15+: +4

**When to Use**: Enable for all psychic summons

### Harrowed Summoning
- Based on Pathfinder's Harrowing system
- Select up to 2 ability score suits:
  - Hammers (STR)
  - Keys (DEX)
  - Shields (CON)
  - Books (INT)
  - Stars (WIS)
  - Crowns (CHA)
- Same suit twice: +6 to that ability
- Two different suits: +4 to each ability
- Alignment Match modifier affects duration:
  - Match: 2x duration
  - Mismatch: 0.5x duration

## Combat Integration

### Automatic Initiative Setup

When summoning during combat:

1. **Combatants Created**: Each summoned token becomes a combatant
2. **Initiative Set**: Summons act immediately after the summoner (initiative + 0.01)
3. **Turn Management**: Combat advances to the first summon's turn
4. **Collision Handling**: Other combatants with the same initiative are bumped by +0.01

### Multiple Summons

All summons from a single casting share initiative:
- They act on the same initiative count
- Turn order cycles through each summon token
- Easier to manage than separate initiatives

### Mid-Combat Summoning

Summons can be called during ongoing combat:
- They're added to the current initiative order
- Duration tracking begins from the current round
- They can act immediately if it's still your turn

## Duration Tracking

### In Combat Mode

- **Duration**: 1 round per caster level
- **Tracking**: By combat round
- **Expiration**: At the start of the summoner's turn when duration expires
- **Notification**: Chat message with delete button

**Example**: CL 10 summons last 10 rounds

### Out of Combat Mode

- **Duration**: 6 seconds per caster level (1 round = 6 seconds)
- **Tracking**: Using Foundry's world time system
- **Expiration**: When world time reaches expiration time
- **Notification**: Chat message with delete button

**Example**: CL 10 summons last 60 seconds of world time

### Transitioning from Combat

When combat ends:
- Combat-based durations automatically convert to world time
- Remaining rounds × 6 seconds
- Tracking continues seamlessly

**Example**: 5 rounds remaining = 30 seconds of world time

### Manual Cleanup

Use the delete button in expiration messages to:
- Remove all tokens
- Delete combatants
- Remove the actor from the world
- Clean up all tracking data

## Macro Usage

### Basic Macro

```javascript
// Open for selected token or player's character
SummonMonster.open();
```

### Macro for Specific Character

```javascript
// Open for a specific actor
const actor = game.actors.getName("Wizard");
SummonMonster.open(actor);
```

### Macro with Token Selection

```javascript
// Open for currently selected token
const token = canvas.tokens.controlled[0];
if (token) {
    SummonMonster.open(token.actor);
} else {
    ui.notifications.warn("Please select a token first.");
}
```

### Hotkey Integration

Create a macro and assign it to a hotkey:
1. Create a macro with `SummonMonster.open()`
2. Drag to hotbar
3. Press the hotbar number to summon

## Tips & Tricks

### For Players

1. **Quick Access**: Drag the summon macro to your hotbar for one-click access

2. **Spell Preparation**: Keep track of which summon spells you have prepared

3. **Range Planning**: Know your range before casting:
   - Standard: 25 + (CL÷2 × 5) feet
   - With Reach: 100 + (CL × 10) feet

4. **Count Formulas**: Use dice formulas for variable summons:
   - `1d3` for Summon Monster II
   - `1d4+1` for Summon Monster V
   - `1d3` with Summon Monster I (small elementals)

5. **Template Strategy**: 
   - Celestial for good campaigns
   - Fiendish for evil campaigns
   - Match your alignment for best thematic fit

### For GMs

1. **Ownership Control**: Use the ownership checkbox to give players control of their summons

2. **Scroll Summoning**: Use CL Override for scrolls or wands with fixed caster levels

3. **Custom Creatures**: Add your own creatures to a compendium and configure it in settings

4. **Balance**: Monitor summon counts in complex battles

5. **Time Management**: Use world time advancement to automatically expire out-of-combat summons

### Optimization Tips

1. **Template Selection**: Only available for creatures marked with `*` in the name

2. **Multiple Summons**: Summon multiple weaker creatures vs. one strong creature based on:
   - Action economy needs
   - Flanking opportunities
   - Damage soaking
   - Area coverage

3. **Duration Extension**: Use Extend Spell for:
   - Exploration scenarios
   - Long battles
   - Battlefield control

4. **Positioning**: Place summons strategically:
   - Flanking positions
   - Blocking chokepoints
   - Protecting allies
   - Threatening enemies

## Common Workflows

### Standard Combat Summon
1. Your turn in combat
2. Click character sheet summon button
3. Select spell level and creature
4. Choose template if applicable
5. Place summon adjacent to enemy
6. Summon acts next in initiative order

### Exploration Summon
1. Out of combat
2. Open summon dialog
3. Enable Extend Metamagic for longer duration
4. Summon scout creature
5. Duration tracks automatically via world time

### Emergency Summon
1. Surprised or ambushed
2. Quick summon for defense
3. Summon multiple weak creatures for action economy
4. Use Portal to place in defensive positions

## Troubleshooting

### Can't Place Summon
- Check range (within summoner's range circle)
- Verify Portal module is working
- Ensure valid floor space

### Wrong Initiative
- Verify summoner is in combat tracker
- Check that summons appear after summoner
- Use combat tracker controls to adjust if needed

### Duration Not Tracking
- Confirm Foundry v13+
- Check console for errors
- Verify world time is enabled

### Delete Button Not Working
- Check permissions
- Try using combat tracker to remove
- Manually delete actor from sidebar if needed
