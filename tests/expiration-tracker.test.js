import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummonManager } from '../scripts/summon-manager.js';
import { ExpirationTracker } from '../scripts/expiration-tracker.js';

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

describe('ExpirationTracker — only GM posts expiry message', () => {
    let updateWorldTime;
    let updateCombat;

    function makeSummonerWithExpiration(mode, overrides = {}) {
        const baseExp = mode === 'combat'
            ? { mode: 'combat', actorId: 'monster-id', expireRound: 3, combatId: 'combat-abc', ...overrides }
            : { mode: 'calendar', actorId: 'monster-id', expireTime: 50, created: Date.now() - 5000, ...overrides };
        return {
            id: 'summoner-id',
            name: 'Test Summoner',
            getFlag: vi.fn().mockReturnValue([baseExp]),
            setFlag: vi.fn().mockResolvedValue(undefined),
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();

        // Capture hook callbacks on registration
        global.Hooks.on.mockImplementation((event, cb) => {
            if (event === 'updateWorldTime') updateWorldTime = cb;
            if (event === 'updateCombat') updateCombat = cb;
            return 1;
        });

        // Allow hooks to re-register each test
        delete global.window._summonWorldTimeHookId;
        delete global.window._summonExpirationHookId;

        // No tokens on canvas → summon is "gone"
        global.canvas.tokens.placeables = [];

        ExpirationTracker._registerWorldTimeHook();
        ExpirationTracker._registerCombatHook();
    });

    it('world-time hook: does not post message when user is not GM', async () => {
        global.game.user.isGM = false;
        global.game.actors.contents = [makeSummonerWithExpiration('calendar')];

        await updateWorldTime(100, 10);

        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('world-time hook: posts message when user is GM', async () => {
        global.game.user.isGM = true;
        global.game.actors.contents = [makeSummonerWithExpiration('calendar')];

        await updateWorldTime(100, 10);

        expect(global.ChatMessage.create).toHaveBeenCalledOnce();
    });

    it('combat hook: does not post message when user is not GM', async () => {
        global.game.user.isGM = false;
        global.game.actors.contents = [makeSummonerWithExpiration('combat')];
        const combat = { id: 'combat-abc', round: 3, turns: [{ tokenId: 'tok-1' }], turn: 0 };
        global.canvas.tokens.placeables = [{ id: 'tok-1', actor: { id: 'monster-id', system: { conditions: { dead: false } } } }];

        await updateCombat(combat, { round: 3 }, {}, 'user-1');

        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('combat hook: posts message when user is GM', async () => {
        global.game.user.isGM = true;
        global.game.actors.contents = [makeSummonerWithExpiration('combat')];
        const combat = { id: 'combat-abc', round: 3, turns: [{ tokenId: 'tok-1' }], turn: 0 };
        global.canvas.tokens.placeables = [{ id: 'tok-1', actor: { id: 'monster-id', system: { conditions: { dead: false } } } }];

        await updateCombat(combat, { round: 3 }, {}, 'user-1');

        expect(global.ChatMessage.create).toHaveBeenCalledOnce();
    });
});
