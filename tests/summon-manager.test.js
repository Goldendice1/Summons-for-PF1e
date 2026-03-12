import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SummonManager, buildSummonChatContent } from '../scripts/summon-manager.js';

// Minimal mock actor used to construct SummonManager instances
function makeMockActor(spellbooks = {}, schoolConCL = 0) {
    return {
        id: 'summoner-id',
        system: {
            attributes: {
                spells: {
                    spellbooks,
                    school: { con: { cl: schoolConCL } },
                },
            },
        },
        ownership: {},
        hasPlayerOwner: false,
    };
}

function makeMockToken() {
    return {
        id: 'token-id',
        document: { disposition: 1, toObject: () => ({}) },
    };
}

function makeManager(actorOverrides = {}, spellbooks = {}) {
    const actor = { ...makeMockActor(spellbooks), ...actorOverrides };
    return new SummonManager(actor, makeMockToken(), {});
}

// Minimal jQuery-like html mock
function makeHtml({
    classVal = 'primary',
    clOverride = '',
    extendChecked = false,
    harrowValue = null,
    reachChecked = false,
    augmentChecked = false,
    harrow1Val = '',
    harrow2Val = '',
    conjuredArmorChecked = false,
    summonCount = '1',
} = {}) {
    return {
        find: (selector) => {
            switch (selector) {
                case '#classSelect': return { val: () => classVal };
                case '#clOverride': return { val: () => clOverride };
                case '#extendCheck': return extendChecked ? [{ checked: true }] : [{ checked: false }];
                case '#harrowMatch': return harrowValue !== null ? [{ value: harrowValue }] : [];
                case '#reachCheck': return reachChecked ? [{ checked: true }] : [{ checked: false }];
                case '#augmentCheck': return augmentChecked ? [{ checked: true }] : [{ checked: false }];
                case '#harrow1': return [{ value: harrow1Val }];
                case '#harrow2': return [{ value: harrow2Val }];
                case '#conjuredArmorCheck': return conjuredArmorChecked ? [{ checked: true }] : [{ checked: false }];
                case '#summonCount': return { val: () => summonCount };
                default: return [];
            }
        },
    };
}

// ── _calculateRange ──────────────────────────────────────────────────────────

describe('_calculateRange', () => {
    const manager = makeManager();

    it('standard range: CL 1 → 25ft', () => {
        expect(manager._calculateRange(makeHtml(), 1)).toBe(25);
    });

    it('standard range: CL 5 → 35ft', () => {
        // 25 + floor(5/2)*5 = 25 + 10 = 35
        expect(manager._calculateRange(makeHtml(), 5)).toBe(35);
    });

    it('standard range: CL 10 → 50ft', () => {
        // 25 + floor(10/2)*5 = 25 + 25 = 50
        expect(manager._calculateRange(makeHtml(), 10)).toBe(50);
    });

    it('standard range: CL 20 → 75ft', () => {
        // 25 + floor(20/2)*5 = 25 + 50 = 75
        expect(manager._calculateRange(makeHtml(), 20)).toBe(75);
    });

    it('reach range: CL 1 → 110ft', () => {
        expect(manager._calculateRange(makeHtml({ reachChecked: true }), 1)).toBe(110);
    });

    it('reach range: CL 5 → 150ft', () => {
        expect(manager._calculateRange(makeHtml({ reachChecked: true }), 5)).toBe(150);
    });

    it('reach range: CL 10 → 200ft', () => {
        expect(manager._calculateRange(makeHtml({ reachChecked: true }), 10)).toBe(200);
    });

    it('reach range: CL 20 → 300ft', () => {
        expect(manager._calculateRange(makeHtml({ reachChecked: true }), 20)).toBe(300);
    });
});

// ── _calculateCasterLevel ────────────────────────────────────────────────────

describe('_calculateCasterLevel', () => {
    it('reads base CL from spellbook cl.total', async () => {
        const manager = makeManager({}, { primary: { cl: { total: 7 } } });
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary' }));
        expect(result.base).toBe(7);
        expect(result.final).toBe(7);
    });

    it('falls back to cl directly if cl.total is absent', async () => {
        const manager = makeManager({}, { primary: { cl: 5 } });
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary' }));
        expect(result.base).toBe(5);
    });

    it('defaults to CL 1 when spellbook is missing', async () => {
        const manager = makeManager({}, {});
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary' }));
        expect(result.base).toBe(1);
    });

    it('adds conjuration school bonus', async () => {
        const actor = makeMockActor({ primary: { cl: { total: 5 } } }, 2);
        const manager = new SummonManager(actor, makeMockToken(), {});
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary' }));
        expect(result.base).toBe(7);
    });

    it('CL override replaces base', async () => {
        const manager = makeManager({}, { primary: { cl: { total: 3 } } });
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary', clOverride: '12' }));
        expect(result.base).toBe(12);
    });

    it('invalid override (<=0) is ignored', async () => {
        const manager = makeManager({}, { primary: { cl: { total: 5 } } });
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary', clOverride: '-1' }));
        expect(result.base).toBe(5);
    });

    it('Extend metamagic doubles final CL', async () => {
        const manager = makeManager({}, { primary: { cl: { total: 6 } } });
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary', extendChecked: true }));
        expect(result.base).toBe(6);
        expect(result.final).toBe(12);
    });

    it('Harrowed multiplier (2x) applied to final CL', async () => {
        const manager = makeManager({}, { primary: { cl: { total: 5 } } });
        const result = await manager._calculateCasterLevel(makeHtml({ classVal: 'primary', harrowValue: '2' }));
        expect(result.final).toBe(10);
    });

    it('Extend then Harrowed: extend doubles first, then harrowed multiplies', async () => {
        const manager = makeManager({}, { primary: { cl: { total: 4 } } });
        const result = await manager._calculateCasterLevel(
            makeHtml({ classVal: 'primary', extendChecked: true, harrowValue: '2' })
        );
        // base=4, extend → 8, harrowed ×2 → 16
        expect(result.base).toBe(4);
        expect(result.final).toBe(16);
    });
});

// ── _applyTemplateResistances ────────────────────────────────────────────────

function makeMockMonster(hd, existingEres = [], existingDr = []) {
    const eres = [...existingEres];
    const dr = [...existingDr];
    return {
        system: {
            traits: {
                eres: { value: eres },
                dr: { value: dr },
            },
            attributes: { hd: { total: hd } },
        },
        update: vi.fn().mockResolvedValue(undefined),
        _eres: eres,
        _dr: dr,
    };
}

describe('_applyTemplateResistances — resistance amounts by HD', () => {
    it('HD < 5 → resistance amount 5', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(3);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._eres[0].amount).toBe(5);
    });

    it('HD 5 → resistance amount 10', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(5);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._eres[0].amount).toBe(10);
    });

    it('HD 10 → resistance amount 10', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(10);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._eres[0].amount).toBe(10);
    });

    it('HD 11 → resistance amount 15', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(11);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._eres[0].amount).toBe(15);
    });
});

describe('_applyTemplateResistances — DR amount by HD', () => {
    it('HD < 5 → no DR added', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(4);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._dr).toHaveLength(0);
    });

    it('HD 5 → DR amount 5', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(5);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._dr[0].amount).toBe(5);
    });

    it('HD 11 → DR amount 10', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(11);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._dr[0].amount).toBe(10);
    });
});

describe('_applyTemplateResistances — Celestial template', () => {
    it('adds acid, cold, electric resistances', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Celestial');
        const types = manager.createdMonster._eres.map(e => e.types[0]);
        expect(types).toContain('acid');
        expect(types).toContain('cold');
        expect(types).toContain('electric');
        expect(types).not.toContain('fire');
    });

    it('DR type is Evil', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Celestial');
        expect(manager.createdMonster._dr[0].types[0]).toBe('Evil');
    });
});

describe('_applyTemplateResistances — Fiendish template', () => {
    it('adds cold and fire resistances only', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Fiendish');
        const types = manager.createdMonster._eres.map(e => e.types[0]);
        expect(types).toContain('cold');
        expect(types).toContain('fire');
        expect(types).not.toContain('acid');
        expect(types).not.toContain('electric');
    });

    it('DR type is Good', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Fiendish');
        expect(manager.createdMonster._dr[0].types[0]).toBe('Good');
    });
});

describe('_applyTemplateResistances — Entropic template', () => {
    it('adds acid and fire resistances only', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Entropic');
        const types = manager.createdMonster._eres.map(e => e.types[0]);
        expect(types).toContain('acid');
        expect(types).toContain('fire');
        expect(types).not.toContain('cold');
        expect(types).not.toContain('electric');
    });

    it('DR type is Law', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Entropic');
        expect(manager.createdMonster._dr[0].types[0]).toBe('Law');
    });
});

describe('_applyTemplateResistances — Resolute template', () => {
    it('adds acid, cold, electric, and fire resistances', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Resolute');
        const types = manager.createdMonster._eres.map(e => e.types[0]);
        expect(types).toContain('acid');
        expect(types).toContain('cold');
        expect(types).toContain('electric');
        expect(types).toContain('fire');
    });

    it('DR type is Chaos', async () => {
        const manager = makeManager();
        manager.createdMonster = makeMockMonster(6);
        await manager._applyTemplateResistances('Resolute');
        expect(manager.createdMonster._dr[0].types[0]).toBe('Chaos');
    });
});

// ── _applyConjuredArmor ──────────────────────────────────────────────────────

describe('_applyConjuredArmor', () => {
    function makeActorWithPsychic(cl) {
        return makeMockActor({
            psychic: {
                class: 'Psychic',
                cl: { total: cl },
            },
        });
    }

    function makeManagerWithPsychic(cl) {
        const actor = makeActorWithPsychic(cl);
        const manager = new SummonManager(actor, makeMockToken(), {});
        manager.createdMonster = {
            createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
        };
        return manager;
    }

    it('no buff created if no psychic spellbook', async () => {
        const actor = makeMockActor({ primary: { class: 'Wizard', cl: { total: 10 } } });
        const manager = new SummonManager(actor, makeMockToken(), {});
        manager.createdMonster = { createEmbeddedDocuments: vi.fn().mockResolvedValue([]) };
        await manager._applyConjuredArmor(makeHtml({ conjuredArmorChecked: true }));
        expect(manager.createdMonster.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('psychic CL 5 → deflection +2', async () => {
        const manager = makeManagerWithPsychic(5);
        await manager._applyConjuredArmor(makeHtml({ conjuredArmorChecked: true }));
        const callArgs = manager.createdMonster.createEmbeddedDocuments.mock.calls[0];
        const buffData = callArgs[1][0];
        expect(buffData.system.changes[0].formula).toBe('2');
    });

    it('psychic CL 8 → deflection +3', async () => {
        const manager = makeManagerWithPsychic(8);
        await manager._applyConjuredArmor(makeHtml({ conjuredArmorChecked: true }));
        const callArgs = manager.createdMonster.createEmbeddedDocuments.mock.calls[0];
        const buffData = callArgs[1][0];
        expect(buffData.system.changes[0].formula).toBe('3');
    });

    it('psychic CL 15 → deflection +4', async () => {
        const manager = makeManagerWithPsychic(15);
        await manager._applyConjuredArmor(makeHtml({ conjuredArmorChecked: true }));
        const callArgs = manager.createdMonster.createEmbeddedDocuments.mock.calls[0];
        const buffData = callArgs[1][0];
        expect(buffData.system.changes[0].formula).toBe('4');
    });

    it('checkbox unchecked → no buff', async () => {
        const manager = makeManagerWithPsychic(10);
        await manager._applyConjuredArmor(makeHtml({ conjuredArmorChecked: false }));
        expect(manager.createdMonster.createEmbeddedDocuments).not.toHaveBeenCalled();
    });
});

// ── _rollSummonCount ─────────────────────────────────────────────────────────

describe('_rollSummonCount', () => {
    it('returns roll result for a valid formula', async () => {
        const manager = makeManager();
        const result = await manager._rollSummonCount(makeHtml({ summonCount: '1d4' }));
        expect(result.total).toBe(1);
    });

    it('defaults to formula "1" when Roll.validate returns false', async () => {
        const validateSpy = vi.spyOn(global.Roll, 'validate').mockReturnValue(false);
        try {
            const manager = makeManager();
            const result = await manager._rollSummonCount(makeHtml({ summonCount: 'bad formula' }));
            expect(result.formula).toBe('1');
        } finally {
            validateSpy.mockRestore();
        }
    });
});

// ── buildSummonChatContent ───────────────────────────────────────────────────

describe('buildSummonChatContent', () => {
    const roll = { formula: '1d4', total: 3 };

    it('includes monster name', () => {
        const html = buildSummonChatContent('Celestial Dog', roll, 5);
        expect(html).toContain('Celestial Dog');
    });

    it('includes roll total', () => {
        const html = buildSummonChatContent('Wolf', roll, 5);
        expect(html).toMatch(/class="inline-roll[^"]*"/);
        expect(html).toContain('3');
    });

    it('includes caster level in rounds text', () => {
        const html = buildSummonChatContent('Wolf', roll, 7);
        expect(html).toContain('7 rounds');
    });

    it('includes roll formula in title attribute', () => {
        const html = buildSummonChatContent('Wolf', roll, 5);
        expect(html).toContain('title="1d4"');
    });
});

// ── _applyAugmentBuff ────────────────────────────────────────────────────────

describe('_applyAugmentBuff', () => {
    function makeManagerWithMonster() {
        const manager = makeManager();
        const buffMock = { update: vi.fn().mockResolvedValue(undefined) };
        manager.createdMonster = {
            name: 'Test Monster',
            items: { find: vi.fn().mockReturnValue(buffMock) },
            createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue(undefined),
            _buff: buffMock,
        };
        return manager;
    }

    it('checkbox unchecked → no buff created', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyAugmentBuff(makeHtml({ augmentChecked: false }));
        expect(manager.createdMonster.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('creates Augment Summoning buff item when checked', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyAugmentBuff(makeHtml({ augmentChecked: true }));
        const [type, items] = manager.createdMonster.createEmbeddedDocuments.mock.calls[0];
        expect(type).toBe('Item');
        expect(items[0].name).toBe('Augment Summoning');
    });

    it('applies +4 Str and +4 Con changes', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyAugmentBuff(makeHtml({ augmentChecked: true }));
        const changes = manager.createdMonster._buff.update.mock.calls[0][0]['system.changes'];
        const strChange = changes.find(c => c.subTarget === 'str');
        const conChange = changes.find(c => c.subTarget === 'con');
        expect(strChange.formula).toBe('4');
        expect(conChange.formula).toBe('4');
    });

    it('renames actor with (Augmented) suffix', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyAugmentBuff(makeHtml({ augmentChecked: true }));
        const updateArg = manager.createdMonster.update.mock.calls[0][0];
        expect(updateArg.name).toContain('(Augmented)');
    });
});

// ── _applyHarrowBuff ─────────────────────────────────────────────────────────

describe('_applyHarrowBuff', () => {
    function makeManagerWithMonster() {
        const manager = makeManager();
        const buffMock = { update: vi.fn().mockResolvedValue(undefined) };
        manager.createdMonster = {
            name: 'Test Monster',
            items: { find: vi.fn().mockReturnValue(buffMock) },
            createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
            _buff: buffMock,
        };
        return manager;
    }

    it('no buff when harrow1 is empty', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyHarrowBuff(makeHtml({ harrow1Val: '' }));
        expect(manager.createdMonster.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('single +6 bonus when harrow1 === harrow2', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyHarrowBuff(makeHtml({ harrow1Val: 'str', harrow2Val: 'str' }));
        const changes = manager.createdMonster._buff.update.mock.calls[0][0]['system.changes'];
        expect(changes).toHaveLength(1);
        expect(changes[0].formula).toBe('6');
        expect(changes[0].subTarget).toBe('str');
    });

    it('single +6 bonus when harrow2 is empty', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyHarrowBuff(makeHtml({ harrow1Val: 'dex', harrow2Val: '' }));
        const changes = manager.createdMonster._buff.update.mock.calls[0][0]['system.changes'];
        expect(changes).toHaveLength(1);
        expect(changes[0].formula).toBe('6');
    });

    it('two +4 bonuses when harrow1 !== harrow2', async () => {
        const manager = makeManagerWithMonster();
        await manager._applyHarrowBuff(makeHtml({ harrow1Val: 'str', harrow2Val: 'dex' }));
        const changes = manager.createdMonster._buff.update.mock.calls[0][0]['system.changes'];
        expect(changes).toHaveLength(2);
        expect(changes[0].formula).toBe('4');
        expect(changes[1].formula).toBe('4');
        expect(changes.map(c => c.subTarget)).toContain('str');
        expect(changes.map(c => c.subTarget)).toContain('dex');
    });
});

// ── _applySummonDurationBuff ──────────────────────────────────────────────────

describe('_applySummonDurationBuff', () => {
    function makeManagerWithMonster() {
        const manager = makeManager();
        manager.createdMonster = {
            setFlag: vi.fn().mockResolvedValue(undefined),
            createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
        };
        return manager;
    }

    it('flags the actor as isSummon', async () => {
        const manager = makeManagerWithMonster();
        await manager._applySummonDurationBuff(5);
        expect(manager.createdMonster.setFlag).toHaveBeenCalledWith('summons-for-pf1e', 'isSummon', true);
    });

    it('creates a buff named "Summoned"', async () => {
        const manager = makeManagerWithMonster();
        await manager._applySummonDurationBuff(5);
        const [type, items] = manager.createdMonster.createEmbeddedDocuments.mock.calls[0];
        expect(type).toBe('Item');
        expect(items[0].name).toBe('Summoned');
        expect(items[0].type).toBe('buff');
    });

    it('sets duration value to casterLevel as a string', async () => {
        const manager = makeManagerWithMonster();
        await manager._applySummonDurationBuff(7);
        const items = manager.createdMonster.createEmbeddedDocuments.mock.calls[0][1];
        expect(items[0].system.duration.value).toBe('7');
    });

    it('sets duration units to "round"', async () => {
        const manager = makeManagerWithMonster();
        await manager._applySummonDurationBuff(5);
        const items = manager.createdMonster.createEmbeddedDocuments.mock.calls[0][1];
        expect(items[0].system.duration.units).toBe('round');
    });

    it('creates buff as active', async () => {
        const manager = makeManagerWithMonster();
        await manager._applySummonDurationBuff(5);
        const items = manager.createdMonster.createEmbeddedDocuments.mock.calls[0][1];
        expect(items[0].system.active).toBe(true);
    });
});

// ── _bumpConflictingInitiatives ───────────────────────────────────────────────

describe('_bumpConflictingInitiatives', () => {
    afterEach(() => {
        global.game.combat = null;
    });

    it('no conflict → no combatants updated', async () => {
        const manager = makeManager();
        const other = { id: 'other', initiative: 3, update: vi.fn() };
        global.game.combat = { combatants: [other] };
        const newCombatants = [{ id: 'new1' }];
        const summoner = { id: 'summoner', initiative: 5 };
        await manager._bumpConflictingInitiatives(newCombatants, summoner, 5.01);
        expect(other.update).not.toHaveBeenCalled();
    });

    it('single conflict → bumped by 0.01', async () => {
        const manager = makeManager();
        const conflicting = { id: 'other', initiative: 5.01, update: vi.fn() };
        global.game.combat = { combatants: [conflicting] };
        const newCombatants = [{ id: 'new1' }];
        const summoner = { id: 'summoner', initiative: 5 };
        await manager._bumpConflictingInitiatives(newCombatants, summoner, 5.01);
        expect(conflicting.update).toHaveBeenCalledWith({ initiative: 5.02 });
    });

    it('chain conflict → each bumped to next available slot', async () => {
        const manager = makeManager();
        const a = { id: 'a', initiative: 5.01, update: vi.fn() };
        const b = { id: 'b', initiative: 5.02, update: vi.fn() };
        global.game.combat = { combatants: [a, b] };
        const newCombatants = [{ id: 'new1' }];
        const summoner = { id: 'summoner', initiative: 5 };
        await manager._bumpConflictingInitiatives(newCombatants, summoner, 5.01);
        expect(a.update).toHaveBeenCalledWith({ initiative: 5.02 });
        expect(b.update).toHaveBeenCalledWith({ initiative: 5.03 });
    });

    it('summoner combatant is never bumped', async () => {
        const manager = makeManager();
        const summoner = { id: 'summoner', initiative: 5.01, update: vi.fn() };
        global.game.combat = { combatants: [summoner] };
        const newCombatants = [{ id: 'new1' }];
        await manager._bumpConflictingInitiatives(newCombatants, summoner, 5.01);
        expect(summoner.update).not.toHaveBeenCalled();
    });

    it('new summoned combatants are never bumped', async () => {
        const manager = makeManager();
        const newC = { id: 'new1', initiative: 5.01, update: vi.fn() };
        global.game.combat = { combatants: [newC] };
        const newCombatants = [newC];
        const summoner = { id: 'summoner', initiative: 5 };
        await manager._bumpConflictingInitiatives(newCombatants, summoner, 5.01);
        expect(newC.update).not.toHaveBeenCalled();
    });
});
