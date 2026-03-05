/**
 * Register module settings
 */
import { MODULE_ID, SUMMON_CONFIG } from './config.js';

export function registerSettings() {
    game.settings.register(MODULE_ID, "packSource", {
        name: "SUMMON.Settings.PackSource.Name",
        hint: "SUMMON.Settings.PackSource.Hint",
        scope: "world",
        config: true,
        type: String,
        default: SUMMON_CONFIG.packSource.join(","),
        onChange: value => {
            console.log(`${MODULE_ID} | Pack source changed to: ${value}`);
        }
    });

    game.settings.register(MODULE_ID, "packTemplateSource", {
        name: "SUMMON.Settings.PackTemplateSource.Name",
        hint: "SUMMON.Settings.PackTemplateSource.Hint",
        scope: "world",
        config: true,
        type: String,
        default: SUMMON_CONFIG.packTemplateSource
    });

    game.settings.register(MODULE_ID, "destinationFolder", {
        name: "SUMMON.Settings.DestinationFolder.Name",
        hint: "SUMMON.Settings.DestinationFolder.Hint",
        scope: "world",
        config: true,
        type: String,
        default: SUMMON_CONFIG.destinationFolder
    });

    game.settings.register(MODULE_ID, "useUserLinkedActorOnly", {
        name: "SUMMON.Settings.UseUserLinkedActorOnly.Name",
        hint: "SUMMON.Settings.UseUserLinkedActorOnly.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: SUMMON_CONFIG.useUserLinkedActorOnly
    });

    game.settings.register(MODULE_ID, "enableAugmentSummoning", {
        name: "SUMMON.Settings.EnableAugmentSummoning.Name",
        hint: "SUMMON.Settings.EnableAugmentSummoning.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: SUMMON_CONFIG.enableAugmentSummoning
    });

    game.settings.register(MODULE_ID, "enableExtendMetamagic", {
        name: "SUMMON.Settings.EnableExtendMetamagic.Name",
        hint: "SUMMON.Settings.EnableExtendMetamagic.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: SUMMON_CONFIG.enableExtendMetamagic
    });

    game.settings.register(MODULE_ID, "enableReachMetamagic", {
        name: "SUMMON.Settings.EnableReachMetamagic.Name",
        hint: "SUMMON.Settings.EnableReachMetamagic.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: SUMMON_CONFIG.enableReachMetamagic
    });

    game.settings.register(MODULE_ID, "enableConjuredArmor", {
        name: "SUMMON.Settings.EnableConjuredArmor.Name",
        hint: "SUMMON.Settings.EnableConjuredArmor.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: SUMMON_CONFIG.enableConjuredArmor
    });

    game.settings.register(MODULE_ID, "enableHarrowedSummoning", {
        name: "SUMMON.Settings.EnableHarrowedSummoning.Name",
        hint: "SUMMON.Settings.EnableHarrowedSummoning.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: SUMMON_CONFIG.enableHarrowedSummoning
    });
}

/**
 * Get current settings as a config object
 */
export function getConfig() {
    const packSource = game.settings.get(MODULE_ID, "packSource").split(",").map(s => s.trim()).filter(s => s);
    
    return {
        packSource,
        packTemplateSource: game.settings.get(MODULE_ID, "packTemplateSource"),
        destinationFolder: game.settings.get(MODULE_ID, "destinationFolder"),
        useUserLinkedActorOnly: game.settings.get(MODULE_ID, "useUserLinkedActorOnly"),
        enableAugmentSummoning: game.settings.get(MODULE_ID, "enableAugmentSummoning"),
        enableExtendMetamagic: game.settings.get(MODULE_ID, "enableExtendMetamagic"),
        enableReachMetamagic: game.settings.get(MODULE_ID, "enableReachMetamagic"),
        enableConjuredArmor: game.settings.get(MODULE_ID, "enableConjuredArmor"),
        enableHarrowedSummoning: game.settings.get(MODULE_ID, "enableHarrowedSummoning")
    };
}
