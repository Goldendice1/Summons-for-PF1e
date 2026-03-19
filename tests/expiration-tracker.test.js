import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExpirationTracker } from '../scripts/expiration-tracker.js';

function makeBuffItem(overrides = {}) {
    return {
        type: 'buff',
        name: 'Summoned',
        parent: {
            id: 'monster-id',
            getFlag: vi.fn().mockReturnValue(true),
        },
        ...overrides,
    };
}

describe('ExpirationTracker — buff expiration hook', () => {
    let updateItem;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();

        delete global.window._summonBuffExpirationHookId;

        global.Hooks.on.mockImplementation((event, cb) => {
            if (event === 'updateItem') updateItem = cb;
            return 1;
        });

        global.game.combat = null;
        global.canvas.tokens.placeables = [];
        global.game.actors.get = vi.fn().mockReturnValue(null);

        ExpirationTracker._registerBuffExpirationHook();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does nothing when user is not GM', async () => {
        global.game.user.isGM = false;
        await updateItem(makeBuffItem(), { system: { active: false } });
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('ignores non-buff item types', async () => {
        global.game.user.isGM = true;
        await updateItem(makeBuffItem({ type: 'spell' }), { system: { active: false } });
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('ignores buffs with a different name', async () => {
        global.game.user.isGM = true;
        await updateItem(makeBuffItem({ name: 'Augment Summoning' }), { system: { active: false } });
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('ignores updates where active is not changing to false', async () => {
        global.game.user.isGM = true;
        await updateItem(makeBuffItem(), { system: { active: true } });
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('ignores updates with no active change', async () => {
        global.game.user.isGM = true;
        await updateItem(makeBuffItem(), { system: { changes: [] } });
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('triggers deletion when Foundry uses dot-notation change shape { "system.active": false }', async () => {
        global.game.user.isGM = true;
        updateItem(makeBuffItem(), { "system.active": false });
        await vi.runAllTimersAsync();
        expect(global.ChatMessage.create).toHaveBeenCalledOnce();
    });

    it('ignores actors not flagged as isSummon', async () => {
        global.game.user.isGM = true;
        const item = makeBuffItem();
        item.parent.getFlag.mockReturnValue(false);
        await updateItem(item, { system: { active: false } });
        expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });

    it('triggers deletion and posts expiry message when Summoned buff deactivates on a summon', async () => {
        global.game.user.isGM = true;
        updateItem(makeBuffItem(), { system: { active: false } });
        await vi.runAllTimersAsync();
        expect(global.ChatMessage.create).toHaveBeenCalledOnce();
        expect(global.ChatMessage.create.mock.calls[0][0].content).toContain('Summon Expired');
    });

    it('does not re-register hook if already registered', () => {
        global.window._summonBuffExpirationHookId = 1;
        ExpirationTracker._registerBuffExpirationHook();
        // Hooks.on was already called once in beforeEach; should not be called again
        expect(global.Hooks.on).toHaveBeenCalledTimes(1);
    });
});

describe('ExpirationTracker._deleteSummon — combat cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.canvas.tokens.placeables = [];
        global.game.actors.get = vi.fn().mockReturnValue(null);
    });

    it('removes combatants when combat is active', async () => {
        const deleteMock = vi.fn().mockResolvedValue(undefined);
        global.game.combat = {
            combatants: [{ id: 'c1', actorId: 'monster-id' }],
            deleteEmbeddedDocuments: deleteMock,
            setupTurns: vi.fn().mockResolvedValue(undefined),
        };

        await ExpirationTracker._deleteSummon('monster-id');

        expect(deleteMock).toHaveBeenCalledWith('Combatant', ['c1']);
    });

    it('skips combatant deletion when no combat', async () => {
        global.game.combat = null;
        // No error should be thrown
        await ExpirationTracker._deleteSummon('monster-id');
        expect(global.ChatMessage.create).toHaveBeenCalled();
    });

    it('deletes the summoned actor', async () => {
        global.game.combat = null;
        const actorDeleteMock = vi.fn().mockResolvedValue(undefined);
        global.game.actors.get = vi.fn().mockReturnValue({ delete: actorDeleteMock });

        await ExpirationTracker._deleteSummon('monster-id');

        expect(actorDeleteMock).toHaveBeenCalled();
    });
});
