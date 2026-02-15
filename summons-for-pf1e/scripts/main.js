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
 * Open the summon dialog
 * @param {Actor} actor - Optional actor to use as summoner
 */
export function openSummonDialog(actor = null) {
    const config = getConfig();
    
    let summonerActor = actor;
    let summonerToken;
    
    if (game.user.isGM || !config.useUserLinkedActorOnly) {
        // GMs must have a token selected
        if (!summonerActor) {
            let selectedTokens = canvas.tokens.controlled;
            if (!selectedTokens.length) {
                ui.notifications.warn("No token chosen as summoner.");
                return;
            }
            summonerToken = selectedTokens[0];
            summonerActor = summonerToken.actor;
        } else {
            // Find token for the actor
            let tokens = canvas.tokens.placeables.filter(t => t.actor && t.actor.id === summonerActor.id);
            if (tokens.length > 0) {
                summonerToken = tokens[0];
            } else {
                ui.notifications.warn(`No token for ${summonerActor.name} found on the canvas.`);
                return;
            }
        }
    } else {
        // Non-GMs must have a character and a token for that character on the map
        summonerActor = summonerActor || game.user.character;
        if (!summonerActor) {
            ui.notifications.warn("No token chosen as summoner.");
            return;
        }
        
        let ownedTokens = canvas.tokens.ownedTokens.filter(
            o => o.actor && o.actor.id === summonerActor.id
        );
        if (!ownedTokens.length) {
            ui.notifications.warn(`No token of summoner ${summonerActor.name} available.`);
            return;
        }
        summonerToken = ownedTokens[0];
    }
    
    if (summonerActor && summonerToken) {
        const dialog = new SummonDialog(summonerActor, summonerToken);
        dialog.render(true);
    }
}



console.log(`${MODULE_ID} | Module loaded. Use SummonMonster.open() to summon or click the Summon button on character sheets.`);
