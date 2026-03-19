/**
 * Handles expiration tracking for summoned creatures
 */
import { MODULE_ID } from './config.js';

export class ExpirationTracker {
    static initialize() {
        this._registerBuffExpirationHook();
        this._registerChatButtonHook();
    }

    static _registerBuffExpirationHook() {
        if (!window._summonBuffExpirationHookId) {
            window._summonBuffExpirationHookId = Hooks.on("updateItem", (item, changes) => {
                if (!game.user.isGM) return;
                if (item.type !== "buff" || item.name !== "Summoned") return;
                // Foundry item updates can use either nested ({ system: { active } })
                // or dot-notation ({ "system.active": value }) change shapes.
                const active = changes.system?.active ?? changes["system.active"];
                if (active !== false) return;

                const actor = item.parent;
                if (!actor?.getFlag("summons-for-pf1e", "isSummon")) return;

                const autoDelete = game.settings.get(MODULE_ID, "autoDeleteOnExpiration");

                if (autoDelete) {
                    // Defer deletion so PF1e can finish its own updateItem processing
                    // before the token is removed (otherwise PF1e errors accessing
                    // the synthetic actor's token after we've deleted it).
                    setTimeout(() => ExpirationTracker._deleteSummon(actor.id).then(() => {
                        ExpirationTracker._postExpiredMessage(actor.id, false);
                    }).catch(err => {
                        console.error("summons-for-pf1e | Error deleting expired summon:", err);
                    }), 0);
                } else {
                    // Post a chat message with a button for the GM to manually delete.
                    setTimeout(() => {
                        ExpirationTracker._postExpiredMessage(actor.id, true);
                    }, 0);
                }
            });
        }
    }

    static _registerChatButtonHook() {
        Hooks.on("renderChatMessage", (_message, html) => {
            html.find(".summon-expire-delete").click(async (event) => {
                if (!game.user.isGM) return;
                const btn = event.currentTarget;
                btn.disabled = true;
                const actorId = btn.dataset.actorId;
                await ExpirationTracker._deleteSummon(actorId).catch(err => {
                    console.error("summons-for-pf1e | Error deleting expired summon:", err);
                    btn.disabled = false;
                });
            });
        });
    }

    static _postExpiredMessage(actorId, withButton) {
        const buttonHtml = withButton
            ? `<div class="card-buttons"><button class="summon-expire-delete" data-actor-id="${actorId}">Delete Summon</button></div>`
            : "";
        ChatMessage.create({
            content: `<div class="pf1 chat-card"><header class="card-header flexrow"><h3 class="actor-name">Summon Expired</h3></header><div class="result-text"><p>The summon duration has expired.</p></div>${buttonHtml}</div>`
        });
    }

    static async _deleteSummon(actorId) {
        const summonedActor = game.actors.get(actorId);
        const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actorId);

        // Close open sheets before deleting so they don't try to submit to a
        // missing document when the user closes them afterward.
        if (summonedActor?.sheet?.rendered) await summonedActor.sheet.close({ force: true });
        for (const token of tokens) {
            if (token.actor?.sheet?.rendered) await token.actor.sheet.close({ force: true });
        }

        // Remove combatants
        if (game.combat) {
            const toDelete = game.combat.combatants.filter(c => c.actorId === actorId);
            if (toDelete.length > 0) {
                await game.combat.deleteEmbeddedDocuments("Combatant", toDelete.map(c => c.id));
            }
        }

        // Delete tokens
        if (tokens.length) {
            const tokenIds = tokens.map(t => t.document.id);
            try {
                await canvas.scene.deleteEmbeddedDocuments("Token", tokenIds);
            } catch (err) {
                for (const token of tokens) {
                    await token.document.delete();
                }
            }
        }

        // Delete the summoned actor
        if (summonedActor) {
            await summonedActor.delete();
        }

        if (game.combat) {
            await game.combat.setupTurns();
        }
    }
}
