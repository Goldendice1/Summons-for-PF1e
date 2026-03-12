/**
 * Handles expiration tracking for summoned creatures
 */
export class ExpirationTracker {
    static initialize() {
        this._registerBuffExpirationHook();
    }

    static _registerBuffExpirationHook() {
        if (!window._summonBuffExpirationHookId) {
            window._summonBuffExpirationHookId = Hooks.on("updateItem", (item, changes) => {
                if (!game.user.isGM) return;
                if (item.type !== "buff" || item.name !== "Summoned") return;
                if (changes.system?.active !== false) return;

                const actor = item.parent;
                if (!actor?.getFlag("summons-for-pf1e", "isSummon")) return;

                // Defer deletion so PF1e can finish its own updateItem processing
                // before the token is removed (otherwise PF1e errors accessing
                // the synthetic actor's token after we've deleted it).
                setTimeout(() => ExpirationTracker._deleteSummon(actor.id), 0);
            });
        }
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

        ChatMessage.create({
            content: `<div class="pf1 chat-card"><header class="card-header flexrow"><h3 class="actor-name">Summon Expired</h3></header><div class="result-text"><p>The summon duration has expired.</p></div></div>`
        });
    }
}
