/**
 * Handles expiration tracking for summoned creatures
 */
export class ExpirationTracker {
    static initialize() {
        this._registerCombatHook();
        this._registerWorldTimeHook();
        this._registerCombatEndHook();
        this._registerChatMessageHook();
    }

    static _registerCombatHook() {
        if (!window._summonExpirationHookId) {
            window._summonExpirationHookId = Hooks.on("updateCombat", async (combat, changed, options, userId) => {
                if (!combat) {
                    console.debug("[SummonMonster] updateCombat hook called with null combat - skipping");
                    return;
                }
                if (!("round" in changed || "turn" in changed)) return;
                
                for (let actor of game.actors.contents) {
                    let expirations = actor.getFlag("world", "summonExpirations");
                    if (!Array.isArray(expirations) || !expirations.length) continue;
                    
                    let changedFlag = false;
                    for (let exp of expirations) {
                        if (exp.mode !== "combat" || exp.combatId !== combat.id) continue;
                        
                        let {actorId, expireRound} = exp;
                        let tokens = canvas.tokens.placeables.filter(
                            t => t.actor && t.actor.id === actorId && !t.actor.system?.conditions?.dead
                        );
                        let tokenIds = tokens.map(t => t.id);
                        let buttonHtml = `<span class='summon-delete-placeholder' data-actor-id='${actorId}' data-summoner-id='${actor.id}'></span>`;
                        
                        if (tokenIds.length === 0) {
                            ChatMessage.create({
                                content: `<div class="pf1 chat-card"><header class="card-header flexrow"><h3 class="actor-name">Summon Expired</h3></header><div class="result-text"><p>The summon duration has expired (all tokens defeated). ${buttonHtml}</p></div></div>`
                            });
                            changedFlag = true;
                        } else if (combat.round === expireRound && combat.turns[combat.turn] && tokenIds.includes(combat.turns[combat.turn].tokenId)) {
                            ChatMessage.create({
                                content: `<div class="pf1 chat-card"><header class="card-header flexrow"><h3 class="actor-name">Summon Expired</h3></header><div class="result-text"><p>The summon duration has expired. ${buttonHtml}</p></div></div>`
                            });
                            changedFlag = true;
                        }
                    }
                    
                    if (changedFlag) {
                        let newExpirations = expirations.filter(exp => {
                            if (exp.mode !== "combat" || exp.combatId !== combat.id) return true;
                            let {actorId, expireRound} = exp;
                            let tokens = canvas.tokens.placeables.filter(
                                t => t.actor && t.actor.id === actorId && !t.actor.system?.conditions?.dead
                            );
                            let tokenIds = tokens.map(t => t.id);
                            if (tokenIds.length === 0) return false;
                            if (combat.round === expireRound && combat.turns[combat.turn] && tokenIds.includes(combat.turns[combat.turn].tokenId)) return false;
                            return true;
                        });
                        await actor.setFlag("world", "summonExpirations", newExpirations);
                    }
                }
            });
        }
    }

    static _registerWorldTimeHook() {
        if (!window._summonWorldTimeHookId) {
            window._summonWorldTimeHookId = Hooks.on("updateWorldTime", async (worldTime, dt) => {
                console.debug("[SummonMonster] updateWorldTime hook fired: worldTime=", worldTime, "dt=", dt);
                
                for (let actor of game.actors.contents) {
                    let expirations = actor.getFlag("world", "summonExpirations");
                    if (!Array.isArray(expirations) || !expirations.length) continue;
                    
                    console.debug(`[SummonMonster] Checking ${expirations.length} expirations for actor ${actor.name}`);
                    let newExpirations = [];
                    let messagePosted = false;
                    
                    for (let exp of expirations) {
                        if (exp.mode !== "calendar") {
                            console.debug("[SummonMonster] Skipping non-calendar expiration:", exp.mode);
                            newExpirations.push(exp);
                            continue;
                        }
                        
                        let { actorId, expireTime, created } = exp;
                        let tokens = canvas.tokens.placeables.filter(
                            t => t.actor && t.actor.id === actorId && !t.actor.system?.conditions?.dead
                        );
                        let tokenIds = tokens.map(t => t.id);
                        
                        // Guard: skip if expiration was just created
                        const nowMs = Date.now();
                        const createdMs = created || 0;
                        const ageMs = nowMs - createdMs;
                        if (ageMs < 1000) {
                            console.debug("[SummonMonster] Skipping freshly-created expiration (age:", ageMs, "ms, actorId:", actorId, ")");
                            newExpirations.push(exp);
                            continue;
                        }
                        
                        console.debug(
                            "[SummonMonster] Expiration check for",
                            actorId,
                            ": worldTime=",
                            worldTime,
                            "expireTime=",
                            expireTime,
                            "tokens=",
                            tokenIds.length
                        );
                        
                        if (tokenIds.length === 0 || worldTime >= expireTime) {
                            console.debug(
                                "[SummonMonster] EXPIRATION TRIGGERED: worldTime",
                                worldTime,
                                ">=",
                                "expireTime",
                                expireTime,
                                "actorId",
                                actorId
                            );
                            
                            if (!messagePosted) {
                                let buttonHtml = `<span class='summon-delete-placeholder' data-actor-id='${actorId}' data-summoner-id='${actor.id}'></span>`;
                                let chatCard = `<div class="pf1 chat-card"><header class="card-header flexrow"><h3 class="actor-name">Summon Expired</h3></header><div class="result-text"><p>The summon duration has expired. ${buttonHtml}</p></div></div>`;
                                ChatMessage.create({ content: chatCard });
                                messagePosted = true;
                            }
                        } else {
                            newExpirations.push(exp);
                        }
                    }
                    
                    if (newExpirations.length !== expirations.length) {
                        await actor.setFlag("world", "summonExpirations", newExpirations);
                    }
                }
            });
        }
    }

    static _registerCombatEndHook() {
        if (!window._summonCombatEndHookId) {
            window._summonCombatEndHookId = Hooks.on("deleteCombat", async (combat, options, userId) => {
                const lastRound = combat.round || 0;
                console.log("[SummonMonster] Combat ended. Converting durations.");
                
                for (let actor of game.actors.contents) {
                    let expirations = await actor.getFlag("world", "summonExpirations");
                    if (!Array.isArray(expirations) || !expirations.length) continue;
                    
                    let updatedExpirations = [];
                    for (let exp of expirations) {
                        if (exp.mode === "combat" && exp.combatId === combat.id) {
                            let remainingRounds = exp.expireRound - lastRound;
                            if (remainingRounds > 0) {
                                const seconds = remainingRounds * 6;
                                const expireTime = game.time.worldTime + seconds;
                                
                                updatedExpirations.push({
                                    mode: "calendar",
                                    actorId: exp.actorId,
                                    tokenId: exp.tokenId,
                                    expireTime,
                                    created: Date.now()
                                });
                            }
                        } else {
                            updatedExpirations.push(exp);
                        }
                    }
                    await actor.setFlag("world", "summonExpirations", updatedExpirations);
                }
            });
        }
    }

    static _registerChatMessageHook() {
        if (!window._summonDeleteButtonHookId) {
            window._summonDeleteButtonHookId = Hooks.on("renderChatMessage", (message, html, data) => {
                html.find('span.summon-delete-placeholder').each(function() {
                    const actorId = $(this).data('actor-id');
                    const summonerId = $(this).data('summoner-id');
                    const button = $(`<button type='button'><i class='fas fa-trash'></i> Delete Summon</button>`);
                    
                    button.on('click', async function() {
                        await ExpirationTracker._deleteSummon(actorId, summonerId);
                        $(this).remove();
                    });
                    
                    $(this).replaceWith(button);
                });
            });
        }
    }

    static async _deleteSummon(actorId, summonerId) {
        // Remove combatants
        if (game.combat) {
            let toDelete = game.combat.combatants.filter(c => c.actorId === actorId);
            if (toDelete.length > 0) {
                let ids = toDelete.map(c => c.id);
                await game.combat.deleteEmbeddedDocuments("Combatant", ids);
            }
        }

        // Delete tokens
        const tokens = canvas.tokens.placeables.filter(t => t.actor && t.actor.id === actorId);
        if (tokens.length) {
            const tokenIds = tokens.map(t => t.document.id);
            try {
                await canvas.scene.deleteEmbeddedDocuments("Token", tokenIds);
            } catch (err) {
                for (let token of tokens) {
                    await token.document.delete();
                }
            }
        }

        // Delete the summoned Actor
        const summonedActor = game.actors.get(actorId);
        if (summonedActor) {
            await summonedActor.delete();
        }

        // Remove expiration entries
        const summoner = game.actors.get(summonerId);
        if (summoner) {
            let expirations = await summoner.getFlag("world", "summonExpirations") || [];
            let newExpirations = expirations.filter(exp => exp.actorId !== actorId);
            await summoner.setFlag("world", "summonExpirations", newExpirations);
        }

        if (game.combat) {
            await game.combat.setupTurns();
        }

        ChatMessage.create({
            content: `<div class="pf1 chat-card"><header class="card-header flexrow"><h3 class="actor-name">Summon Deleted</h3></header><div class="result-text"><p>The summon has been deleted.</p></div></div>`
        });
    }
}
