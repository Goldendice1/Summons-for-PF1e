/**
 * Manages the summoning process
 */
export class SummonManager {
    constructor(summonerActor, summonerToken, config) {
        this.summonerActor = summonerActor;
        this.summonerToken = summonerToken;
        this.config = config;
        this.gNumSpawned = 0;
        this.gNeedSpawn = 0;
        this.createdMonster = null;
        this.range = 0;
    }

    async importMonster(html) {
        const selectedPack = html.find("#sourceSelect")[0].value;
        const selectedMonster = html.find("#monsterSelect")[0].value;
        
        // Create destination folder
        const folderID = await this._getOrCreateFolder();
        
        // Import actor
        console.log("Importing Actor");
        let monsterEntity = await game.packs.get(selectedPack).getDocument(selectedMonster);
        this.createdMonster = await Actor.create(monsterEntity.toObject());
        this.createdMonster = game.actors.get(this.createdMonster.id);

        // Update permissions
        await this._updatePermissions(html, folderID);
        
        // Roll count
        const rollResult = await this._rollSummonCount(html);
        this.gNeedSpawn = rollResult.total;
        
        // Calculate caster level
        const casterLevel = await this._calculateCasterLevel(html);
        
        // Calculate range
        this.range = this._calculateRange(html, casterLevel.base);
        
        // Apply templates
        await this._applyTemplate(html);
        
        // Apply buffs
        await this._applyBuffs(html);
        
        // Set disposition
        await this.createdMonster.update({
            "prototypeToken.disposition": this.summonerToken.document.disposition
        });
        
        // Spawn summons
        const spawnedTokens = await this._spawnSummons();
        
        // Set up duration tracking
        if (spawnedTokens.firstToken) {
            await this._setupDurationTracking(spawnedTokens.firstToken, casterLevel.final);
        }
        
        // Set up combat
        if (game.combat && spawnedTokens.tokenIds.length > 0) {
            await this._setupCombat(spawnedTokens.tokenIds);
        }
        
        // Create chat message
        this._createChatMessage(rollResult, casterLevel.final);
    }

    async _getOrCreateFolder() {
        if (!this.config.destinationFolder) return "";
        
        let summonFolder = game.folders.getName(this.config.destinationFolder);
        if (!summonFolder) {
            let folder = await Folder.create({
                name: this.config.destinationFolder,
                type: "Actor",
                parent: null
            });
            return folder.id;
        }
        return summonFolder.id;
    }

    async _updatePermissions(html, folderID) {
        // Build new ownership object
        let ownership = foundry.utils.duplicate(this.createdMonster.ownership || {});
        ownership[game.userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        
        if (game.user.isGM && this.summonerActor.hasPlayerOwner) {
            let giveOwnerCheck = html.find('#ownerCheck').length > 0 && html.find('#ownerCheck')[0].checked;
            if (giveOwnerCheck) {
                ownership = foundry.utils.duplicate(this.summonerActor.ownership);
            }
        }
        
        await this.createdMonster.update({
            "folder": folderID,
            "ownership": ownership
        });
    }

    async _rollSummonCount(html) {
        let countFormula = html.find("#summonCount").val();
        
        let testRoll = new Roll(countFormula);
        if (!Roll.validate(countFormula) || (await testRoll.evaluate({minimize: true}).total <= 0)) {
            ui.notifications.error(`${countFormula} not a valid roll formula. Defaulting to 1.`);
            countFormula = "1";
        }
        
        testRoll = new Roll(countFormula);
        const roll = await testRoll.roll();
        return roll;
    }

    async _calculateCasterLevel(html) {
        const chosenKey = html.find("#classSelect").val();
        const spellbooks = this.summonerActor.system?.attributes?.spells?.spellbooks || {};
        const classCL = (spellbooks[chosenKey]?.cl?.total) || spellbooks[chosenKey]?.cl || 1;
        
        let conjBonus = 0;
        const schoolConCL = this.summonerActor.system?.attributes?.spells?.school?.con?.cl;
        if (typeof schoolConCL === 'number' && schoolConCL > 0) {
            conjBonus = schoolConCL;
        }
        
        let baseCasterLevel = classCL + conjBonus;
        const clOverride = parseInt(html.find("#clOverride").val());
        
        if (!isNaN(clOverride)) {
            if (clOverride <= 0) {
                ui.notifications.error(`${clOverride} not a valid caster level. Defaulting to spellbook CL.`);
            } else {
                baseCasterLevel = clOverride;
            }
        }
        
        let finalCasterLevel = baseCasterLevel;
        
        // Apply Extend metamagic
        if (html.find("#extendCheck")[0]?.checked) {
            finalCasterLevel *= 2;
        }
        
        // Apply Harrow Match
        if (html.find("#harrowMatch")[0]) {
            finalCasterLevel = Math.floor(finalCasterLevel * html.find("#harrowMatch")[0].value);
        }
        
        return {
            base: baseCasterLevel,
            final: finalCasterLevel
        };
    }

    _calculateRange(html, casterLevel) {
        if (html.find("#reachCheck")[0]?.checked) {
            return 100 + (casterLevel * 10);
        }
        return 25 + (Math.floor(casterLevel / 2) * 5);
    }

    async _applyTemplate(html) {
        const templateSelect = html.find("#template");
        const templateName = templateSelect.prop("disabled") ? "" : templateSelect.val();
        
        if (templateName === "") return;
        
        const pack = game.packs.get(this.config.packTemplateSource);
        let template = null;
        const index = await pack.getIndex();
        const entry = index.find(e => e.name === templateName);
        
        if (entry) {
            template = await pack.getDocument(entry._id);
        }

        if (!template) {
            ui.notifications.error(`Template ${templateName} not found.`);
            return;
        }

        await this.createdMonster.createEmbeddedDocuments("Item", [template]);
        
        const actorName = this.createdMonster.name + ', ' + templateName;
        await this.createdMonster.update({
            "name": actorName,
            "token.name": actorName
        });

        // Handle resistances/DR logic
        await this._applyTemplateResistances(templateName);
        
        // Update alignment
        await this.createdMonster.update({
            "system.details.alignment": this.summonerActor.system.details.alignment
        });
    }

    async _applyTemplateResistances(templateName) {
        let eres = this.createdMonster.system.traits.eres.value;
        const hd = this.createdMonster.system.attributes.hd.total;
        const resNum = hd >= 11 ? 15 : (hd >= 5 ? 10 : 5);
        const drNum = hd >= 11 ? 10 : (hd >= 5 ? 5 : 0);
        
        const acidRes = ["Celestial", "Entropic", "Resolute"];
        const coldRes = ["Celestial", "Counterpoised", "Dark", "Fiendish", "Resolute"];
        const elecRes = ["Celestial", "Counterpoised", "Resolute"];
        const fireRes = ["Counterpoised", "Entropic", "Fiendish", "Resolute"];

        if (acidRes.includes(templateName)) {
            eres.push({"amount": resNum, "types": ["acid"]});
        }
        if (coldRes.includes(templateName)) {
            eres.push({"amount": resNum, "types": ["cold"]});
        }
        if (elecRes.includes(templateName)) {
            eres.push({"amount": resNum, "types": ["electric"]});
        }
        if (fireRes.includes(templateName)) {
            eres.push({"amount": resNum, "types": ["fire"]});
        }

        await this.createdMonster.update({"system.traits.eres.value": eres});

        if (hd >= 5) {
            let ddr = this.createdMonster.system.traits.dr.value;
            const typeMap = new Map([
                ["Celestial", "Evil"],
                ["Fiendish", "Good"],
                ["Resolute", "Chaos"],
                ["Entropic", "Law"]
            ]);
            const drType = typeMap.get(templateName) || "-";
            ddr.push({"amount": drNum, "types": [drType]});
            await this.createdMonster.update({"system.traits.dr.value": ddr});
        }
    }

    async _applyBuffs(html) {
        await this._applyAugmentBuff(html);
        await this._applyHarrowBuff(html);
        await this._applyConjuredArmor(html);
    }

    async _applyAugmentBuff(html) {
        if (!html.find("#augmentCheck")[0]?.checked) return;
        
        const buffData = {
            type: "buff",
            name: "Augment Summoning",
            system: { buffType: "temp" }
        };
        
        await this.createdMonster.createEmbeddedDocuments("Item", [buffData]);
        const buff = this.createdMonster.items.find(o => o.name === "Augment Summoning" && o.type === "buff");
        
        const changes = [
            {formula: "4", priority: 1, target: "ability", subTarget: "str", modifier: "enh"},
            {formula: "4", priority: 1, target: "ability", subTarget: "con", modifier: "enh"}
        ];
        
        await buff.update({
            "system.changes": changes,
            "system.hideFromToken": true,
            "system.active": true
        });
        
        const actorName = this.createdMonster.name + " (Augmented)";
        await this.createdMonster.update({
            "name": actorName,
            "token.name": actorName
        });
    }

    async _applyHarrowBuff(html) {
        if (!html.find("#harrow1")[0] || html.find("#harrow1")[0].value === "") return;
        
        const buffData = {
            type: "buff",
            name: "Harrowed Summoning",
            system: { buffType: "temp" }
        };
        
        await this.createdMonster.createEmbeddedDocuments("Item", [buffData]);
        const buff = this.createdMonster.items.find(o => o.name === "Harrowed Summoning" && o.type === "buff");
        
        const changes = [];
        const harrow1 = html.find("#harrow1")[0].value;
        const harrow2 = html.find("#harrow2")[0].value;
        
        if (harrow1 === harrow2 || harrow2 === "") {
            changes.push({
                formula: "6",
                priority: 1,
                target: "ability",
                subTarget: harrow1,
                modifier: "enh"
            });
        } else {
            changes.push({
                formula: "4",
                priority: 1,
                target: "ability",
                subTarget: harrow1,
                modifier: "enh"
            });
            changes.push({
                formula: "4",
                priority: 1,
                target: "ability",
                subTarget: harrow2,
                modifier: "enh"
            });
        }
        
        await buff.update({
            "system.changes": changes,
            "system.hideFromToken": true,
            "system.active": true
        });
    }

    async _applyConjuredArmor(html) {
        if (!html.find("#conjuredArmorCheck")[0]?.checked) return;
        
        const spellbooks = this.summonerActor.system?.attributes?.spells?.spellbooks || {};
        let psychicLevel = 0;
        
        for (let key in spellbooks) {
            const sb = spellbooks[key];
            const className = (typeof sb.class === 'string') ? sb.class : 
                            (sb.class && typeof sb.class.name === 'string' ? sb.class.name : undefined);
            if (className && className.toLowerCase().includes("psychic")) {
                psychicLevel = sb.cl?.total || sb.cl || 0;
                break;
            }
        }
        
        if (psychicLevel > 0) {
            let deflectionBonus = 2;
            if (psychicLevel >= 8) deflectionBonus += 1;
            if (psychicLevel >= 15) deflectionBonus += 1;
            
            const conjuredArmorBuff = {
                type: "buff",
                name: "Conjured Armor",
                img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
                system: {
                    buffType: "temp",
                    changes: [{
                        formula: `${deflectionBonus}`,
                        priority: 1,
                        target: "ac",
                        type: "deflection"
                    }],
                    hideFromToken: true,
                    active: true
                }
            };
            
            await this.createdMonster.createEmbeddedDocuments("Item", [conjuredArmorBuff]);
        }
    }

    async _spawnSummons() {
        console.log("Spawning summons");
        let firstSummonedToken = null;
        let spawnedTokenIds = [];
        
        while (this.gNumSpawned < this.gNeedSpawn) {
            ui.notifications.info(
                `Click spawn location for ${this.createdMonster.name} within ${this.range} ft of summoner (${this.gNumSpawned} of ${this.gNeedSpawn})`
            );
            
            let portal = new Portal();
            await portal.addCreature(this.createdMonster);
            portal.color("#9e17cf");
            portal.texture("icons/magic/symbols/runes-triangle-magenta.webp");
            portal.origin(this.summonerToken);
            portal.range(this.range);
            await portal.pick();
            const spawnedTokens = await portal.spawn();

            if (this.gNumSpawned === 0 && spawnedTokens && spawnedTokens.length > 0) {
                firstSummonedToken = spawnedTokens[0];
                spawnedTokenIds = spawnedTokens.map(t => t.id);
            } else if (this.gNumSpawned === 0 && canvas.tokens.placeables) {
                firstSummonedToken = canvas.tokens.placeables.find(
                    t => t.actor && t.actor.id === this.createdMonster.id
                );
                if (firstSummonedToken) spawnedTokenIds.push(firstSummonedToken.id);
            }
            
            this.gNumSpawned++;
        }
        
        ui.notifications.info("Done spawning summons!");
        
        return {
            firstToken: firstSummonedToken,
            tokenIds: spawnedTokenIds
        };
    }

    async _setupDurationTracking(firstToken, casterLevel) {
        let expirationData = {};
        
        if (game.combat) {
            // Combat Mode
            const combat = game.combat;
            const currentRound = combat.round;
            const duration = casterLevel;
            const expireRound = currentRound + duration;
            
            expirationData = {
                mode: "combat",
                actorId: this.createdMonster.id,
                tokenId: firstToken.id,
                expireRound,
                combatId: combat.id,
                created: Date.now()
            };
            
            console.debug("[SummonMonster] Created combat expiration:", expirationData);
        } else {
            // Out of Combat Mode - Uses Core World Time
            const seconds = casterLevel * 6;
            const expireTime = game.time.worldTime + seconds;
            
            expirationData = {
                mode: "calendar",
                actorId: this.createdMonster.id,
                tokenId: firstToken.id,
                expireTime,
                created: Date.now()
            };
            
            console.debug(
                "[SummonMonster] Created calendar expiration: worldTime",
                game.time.worldTime,
                "expireTime",
                expirationData.expireTime,
                "seconds",
                seconds
            );
        }
        
        // Save flags
        let prevExpirations = await this.summonerActor.getFlag("world", "summonExpirations") || [];
        prevExpirations.push(expirationData);
        await this.summonerActor.setFlag("world", "summonExpirations", prevExpirations);
    }

    async _setupCombat(spawnedTokenIds) {
        // Wait for tokens to register
        const waitForTokens = async (ids, timeout = 2000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const foundAll = ids.length === 0 || ids.every(id => !!canvas.tokens.get(id));
                if (foundAll) return true;
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        };

        if (spawnedTokenIds.length) {
            const ok = await waitForTokens(spawnedTokenIds, 2500);
            if (!ok) {
                console.warn("[SummonMonster] Some spawned tokens did not register in time:", spawnedTokenIds);
            }
        }

        // Get all tokens for this actor
        let tokens = canvas.tokens.placeables.filter(
            t => t.actor && t.actor.id === this.createdMonster.id
        );
        
        console.debug(
            "[SummonMonster] Found",
            tokens.length,
            "tokens for combatant creation, spawnedTokenIds:",
            spawnedTokenIds
        );

        if (tokens.length === 0) {
            console.warn("[SummonMonster] No tokens found after spawn; skipping combat setup");
            return;
        }

        const summonerCombatant = game.combat.combatants.find(
            c => c.actorId === this.summonerActor.id
        );
        const initiative = summonerCombatant?.initiative !== null ? summonerCombatant.initiative : 0;

        // Create combatants
        const combatantDataArray = tokens.map(token => ({
            tokenId: token.id,
            actorId: this.createdMonster.id,
            sceneId: canvas.scene?.id || null,
            token: token.document.toObject()
        }));

        console.debug("[SummonMonster] Adding", combatantDataArray.length, "combatants to combat");
        const newSummonedCombatants = await game.combat.createEmbeddedDocuments("Combatant", combatantDataArray);
        
        console.debug(
            "[SummonMonster] Created combatants:",
            newSummonedCombatants.map(c => ({id: c.id, tokenId: c.tokenId, actorId: c.actorId}))
        );

        // Ensure combatants reference tokens properly
        for (let combatant of newSummonedCombatants) {
            const token = canvas.tokens.get(combatant.tokenId);
            if (token) {
                try {
                    await combatant.update({
                        tokenId: token.id,
                        actorId: this.createdMonster.id,
                        sceneId: canvas.scene?.id || null,
                        name: token.name
                    });
                    console.debug(
                        "[SummonMonster] Ensured combatant",
                        combatant.id,
                        "-> token",
                        token.id,
                        "actor",
                        this.createdMonster.id,
                        "name",
                        token.name
                    );
                } catch (err) {
                    console.warn("[SummonMonster] Failed to update combatant properties for", combatant.id, err);
                }
            }
        }

        if (newSummonedCombatants.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));

            // Set initiative
            let newInit = Number((initiative + 0.01).toFixed(2));
            for (let c of newSummonedCombatants) {
                await c.update({initiative: newInit});
            }

            // Bump conflicting initiatives
            await this._bumpConflictingInitiatives(newSummonedCombatants, summonerCombatant, newInit);
            
            await game.combat.setupTurns();

            // Set combat turn to first summoned
            await this._setTurnToSummoned(newSummonedCombatants);
        }
    }

    async _bumpConflictingInitiatives(newSummonedCombatants, summonerCombatant, newInit) {
        let allCombatants = Array.from(game.combat.combatants);
        const newSummonedIds = newSummonedCombatants.map(c => c.id);
        let toBump = allCombatants.filter(
            c => !newSummonedIds.includes(c.id) && 
                 c.id !== summonerCombatant?.id && 
                 c.initiative === newInit
        );
        
        let bumpInit = newInit;
        const bumpedIds = new Set();
        
        while (toBump.length > 0) {
            bumpInit = Number((bumpInit + 0.01).toFixed(2));
            for (let c of toBump) {
                if (!bumpedIds.has(c.id)) {
                    await c.update({initiative: bumpInit});
                    bumpedIds.add(c.id);
                }
            }
            allCombatants = Array.from(game.combat.combatants);
            toBump = allCombatants.filter(
                c => !newSummonedIds.includes(c.id) && 
                     c.id !== summonerCombatant?.id && 
                     c.initiative === bumpInit && 
                     !bumpedIds.has(c.id)
            );
        }
    }

    async _setTurnToSummoned(newSummonedCombatants) {
        try {
            const newSummonedIds = newSummonedCombatants.map(c => c.id);
            if (newSummonedIds.length) {
                const turnIndex = game.combat.turns.findIndex(t => newSummonedIds.includes(t.id));
                if (turnIndex !== -1) {
                    await game.combat.update({turn: turnIndex});
                    console.debug("[SummonMonster] Set combat turn to summoned combatant at index", turnIndex);
                }
            }
        } catch (err) {
            console.warn("[SummonMonster] Failed to set combat turn to summoned combatant:", err);
        }
    }

    _createChatMessage(roll, casterLevel) {
        const msg = `
        <div class="pf1 chat-card">
            <header class="card-header flexrow">
                <h3 class="actor-name">Summoning!</h3>
            </header>
            <div class="result-text">
                <p><a class="inline-roll inline-result" title="${roll.formula}" data-roll="${encodeURI(JSON.stringify(roll))}">
                    <i class="fas fa-dice-d20"></i> ${roll.total}
                </a> ${this.createdMonster.name} summoned for ${casterLevel} rounds.</p>
            </div>
        </div>`;

        ChatMessage.create({ content: msg });
    }
}
