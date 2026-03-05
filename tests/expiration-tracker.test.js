import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummonManager } from '../scripts/summon-manager.js';

// Tests for duration/expiration calculation logic in _setupDurationTracking.
// We test the math directly by examining what gets saved to the actor's flags.

function makeMockActor() {
    return {
        id: 'summoner-id',
        system: { attributes: { spells: { spellbooks: {}, school: { con: { cl: 0 } } } } },
        ownership: {},
        hasPlayerOwner: false,
        getFlag: vi.fn().mockResolvedValue([]),
        setFlag: vi.fn().mockResolvedValue(undefined),
    };
}

function makeFirstToken(id = 'token-001') {
    return { id };
}

describe('_setupDurationTracking — combat mode', () => {
    beforeEach(() => {
        // Reset game to combat state
        global.game.combat = {
            id: 'combat-abc',
            round: 3,
        };
    });

    it('expireRound = currentRound + casterLevel', async () => {
        const actor = makeMockActor();
        const manager = new SummonManager(actor, {}, {});
        manager.createdMonster = { id: 'monster-id' };

        await manager._setupDurationTracking(makeFirstToken(), 5);

        const [, , expirations] = actor.setFlag.mock.calls[0];
        const exp = expirations[0];
        expect(exp.mode).toBe('combat');
        expect(exp.expireRound).toBe(3 + 5); // round 3 + CL 5 = 8
    });

    it('stores correct combat and actor IDs', async () => {
        const actor = makeMockActor();
        const manager = new SummonManager(actor, {}, {});
        manager.createdMonster = { id: 'monster-xyz' };

        await manager._setupDurationTracking(makeFirstToken('tok-99'), 10);

        const [, , expirations] = actor.setFlag.mock.calls[0];
        const exp = expirations[0];
        expect(exp.actorId).toBe('monster-xyz');
        expect(exp.tokenId).toBe('tok-99');
        expect(exp.combatId).toBe('combat-abc');
    });

    it('appends to existing expirations rather than replacing', async () => {
        const existing = [{ mode: 'combat', actorId: 'old-monster', expireRound: 5, combatId: 'combat-abc' }];
        const actor = makeMockActor();
        actor.getFlag.mockResolvedValue(existing);
        const manager = new SummonManager(actor, {}, {});
        manager.createdMonster = { id: 'new-monster' };

        await manager._setupDurationTracking(makeFirstToken(), 2);

        const [, , expirations] = actor.setFlag.mock.calls[0];
        expect(expirations).toHaveLength(2);
        expect(expirations[0].actorId).toBe('old-monster');
        expect(expirations[1].actorId).toBe('new-monster');
    });
});

describe('_setupDurationTracking — calendar mode', () => {
    beforeEach(() => {
        // No active combat
        global.game.combat = null;
        global.game.time = { worldTime: 1000 };
    });

    it('expireTime = worldTime + casterLevel * 6', async () => {
        const actor = makeMockActor();
        const manager = new SummonManager(actor, {}, {});
        manager.createdMonster = { id: 'monster-id' };

        await manager._setupDurationTracking(makeFirstToken(), 5);

        const [, , expirations] = actor.setFlag.mock.calls[0];
        const exp = expirations[0];
        expect(exp.mode).toBe('calendar');
        expect(exp.expireTime).toBe(1000 + 5 * 6); // 1030
    });

    it('CL 1 → 6 seconds duration', async () => {
        global.game.time = { worldTime: 0 };
        const actor = makeMockActor();
        const manager = new SummonManager(actor, {}, {});
        manager.createdMonster = { id: 'monster-id' };

        await manager._setupDurationTracking(makeFirstToken(), 1);

        const [, , expirations] = actor.setFlag.mock.calls[0];
        expect(expirations[0].expireTime).toBe(6);
    });

    it('CL 20 → 120 seconds duration', async () => {
        global.game.time = { worldTime: 500 };
        const actor = makeMockActor();
        const manager = new SummonManager(actor, {}, {});
        manager.createdMonster = { id: 'monster-id' };

        await manager._setupDurationTracking(makeFirstToken(), 20);

        const [, , expirations] = actor.setFlag.mock.calls[0];
        expect(expirations[0].expireTime).toBe(500 + 120); // 620
    });
});
