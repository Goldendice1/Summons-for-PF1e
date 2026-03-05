import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummonManager } from '../scripts/summon-manager.js';

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
                case '#harrow1': return harrow1Val !== '' ? [{ value: harrow1Val }] : [];
                case '#harrow2': return harrow2Val !== '' ? [{ value: harrow2Val }] : [];
                case '#conjuredArmorCheck': return conjuredArmorChecked ? [{ checked: true }] : [{ checked: false }];
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
