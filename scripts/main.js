/**
 * Summon Monster Module for Foundry VTT v13
 * Main entry point
 */
import { MODULE_ID, MODULE_NAME } from './config.js';
import { ExpirationTracker } from './expiration-tracker.js';
import { getConfig, registerSettings } from './settings.js';
import { SummonDialog } from './summon-dialog.js';

console.log(`${MODULE_ID} | Initializing ${MODULE_NAME}`);

// Initialize module
Hooks.once('init', async function() {
    console.log(`${MODULE_ID} | Initializing`);
    
    // Register settings
    registerSettings();
    
    // Register API
    game.modules.get(MODULE_ID).api = {
        openSummonDialog,
        SummonDialog,
        getConfig
    };
    
    console.log(`${MODULE_ID} | Initialized`);
});

// Setup module after game is ready
Hooks.once('ready', async function() {
    console.log(`${MODULE_ID} | Ready`);
    
    // Initialize expiration tracking
    ExpirationTracker.initialize();

    // Expose API to console for macros
    window.SummonMonster = {
        open: openSummonDialog
    };
    
    console.log(`${MODULE_ID} | Setup complete`);
});

/**
 * Add summon button to character sheet
 */
Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
    if (!sheet.actor) return;
    
    // Only add for actors with spellbooks
    const spellbooks = sheet.actor.system?.attributes?.spells?.spellbooks;
    if (!spellbooks || Object.keys(spellbooks).length === 0) return;
    
    buttons.unshift({
        label: "Summon",
        class: "summon-monster",
        icon: "fas fa-magic",
        onclick: () => openSummonDialog(sheet.actor)
    });
});

/**
 * Determine the summoner actor and token from canvas/user state.
 * Pure function — no Foundry API side effects.
 * @returns {{ valid: true, actor: Actor, token: Token } | { valid: false, error: string }}
 */
export function validateSummonerTarget({ isGM, useUserLinkedActorOnly, actor, character, controlledTokens, placeableTokens, ownedTokens }) {
    let summonerActor = actor;
    let summonerToken;

    if (isGM || !useUserLinkedActorOnly) {
        if (!summonerActor) {
            if (!controlledTokens.length) {
                return { valid: false, error: "No token chosen as summoner." };
            }
            summonerToken = controlledTokens[0];
            if (!summonerToken?.actor) {
                return { valid: false, error: "Selected token has no associated actor." };
            }
            summonerActor = summonerToken.actor;
        } else {
            const tokens = placeableTokens.filter(t => t.actor && t.actor.id === summonerActor.id);
            if (tokens.length > 0) {
                summonerToken = tokens[0];
            } else {
                return { valid: false, error: `No token for ${summonerActor.name} found on the canvas.` };
            }
        }
    } else {
        summonerActor = summonerActor || character;
        if (!summonerActor) {
            return { valid: false, error: "No token chosen as summoner." };
        }
        const filtered = ownedTokens.filter(o => o.actor && o.actor.id === summonerActor.id);
        if (!filtered.length) {
            return { valid: false, error: `No token of summoner ${summonerActor.name} available.` };
        }
        summonerToken = filtered[0];
    }

    return { valid: true, actor: summonerActor, token: summonerToken };
}

/**
 * Open the summon dialog
 * @param {Actor} actor - Optional actor to use as summoner
 * @param {object} defaults - Optional default values for dialog fields
 * @param {boolean} defaults.conjurersFocus - If true, default duration to minutes per level (Occultist Arcanist archetype) instead of rounds per level
 */
export function openSummonDialog(actor = null, defaults = {}) {
    const config = getConfig();

    const result = validateSummonerTarget({
        isGM: game.user.isGM,
        useUserLinkedActorOnly: config.useUserLinkedActorOnly,
        actor,
        character: game.user.character,
        controlledTokens: canvas.tokens.controlled,
        placeableTokens: canvas.tokens.placeables,
        ownedTokens: canvas.tokens.ownedTokens,
    });

    if (!result.valid) {
        ui.notifications.warn(result.error);
        return;
    }

    const dialog = new SummonDialog(result.actor, result.token, defaults);
    dialog.render(true);
}



console.log(`${MODULE_ID} | Module loaded. Use SummonMonster.open() to summon or click the Summon button on character sheets.`);
