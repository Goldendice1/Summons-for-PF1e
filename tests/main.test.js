import { describe, it, expect } from 'vitest';
import { validateSummonerTarget } from '../scripts/main.js';

function makeActor(id = 'actor-1', name = 'Summoner') {
    return { id, name };
}

function makeToken(actor = makeActor()) {
    return { id: 'token-1', actor };
}

// ── validateSummonerTarget ────────────────────────────────────────────────────

describe('validateSummonerTarget — GM / useUserLinkedActorOnly=false path', () => {
    const baseGM = { isGM: true, useUserLinkedActorOnly: false, character: null };

    it('no actor and no controlled tokens → invalid', () => {
        const result = validateSummonerTarget({ ...baseGM, actor: null, controlledTokens: [], placeableTokens: [], ownedTokens: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/No token chosen/);
    });

    it('no actor but controlled token present → uses token actor', () => {
        const actor = makeActor();
        const token = makeToken(actor);
        const result = validateSummonerTarget({ ...baseGM, actor: null, controlledTokens: [token], placeableTokens: [], ownedTokens: [] });
        expect(result.valid).toBe(true);
        expect(result.actor).toBe(actor);
        expect(result.token).toBe(token);
    });

    it('actor provided but no matching token on canvas → invalid', () => {
        const actor = makeActor('actor-1');
        const result = validateSummonerTarget({ ...baseGM, actor, controlledTokens: [], placeableTokens: [], ownedTokens: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/No token for/);
    });

    it('actor provided and matching token on canvas → valid', () => {
        const actor = makeActor('actor-1');
        const token = makeToken(actor);
        const result = validateSummonerTarget({ ...baseGM, actor, controlledTokens: [], placeableTokens: [token], ownedTokens: [] });
        expect(result.valid).toBe(true);
        expect(result.actor).toBe(actor);
        expect(result.token).toBe(token);
    });

    it('actor provided but canvas token belongs to different actor → invalid', () => {
        const actor = makeActor('actor-1');
        const otherToken = makeToken(makeActor('actor-2'));
        const result = validateSummonerTarget({ ...baseGM, actor, controlledTokens: [], placeableTokens: [otherToken], ownedTokens: [] });
        expect(result.valid).toBe(false);
    });
});

describe('validateSummonerTarget — non-GM + useUserLinkedActorOnly=true path', () => {
    const basePlayer = { isGM: false, useUserLinkedActorOnly: true };

    it('no actor and no user character → invalid', () => {
        const result = validateSummonerTarget({ ...basePlayer, actor: null, character: null, controlledTokens: [], placeableTokens: [], ownedTokens: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/No token chosen/);
    });

    it('no actor but user character set and owned token present → valid', () => {
        const actor = makeActor('actor-1');
        const token = makeToken(actor);
        const result = validateSummonerTarget({ ...basePlayer, actor: null, character: actor, controlledTokens: [], placeableTokens: [], ownedTokens: [token] });
        expect(result.valid).toBe(true);
        expect(result.actor).toBe(actor);
        expect(result.token).toBe(token);
    });

    it('actor set but no owned token for it → invalid', () => {
        const actor = makeActor('actor-1', 'Gandalf');
        const result = validateSummonerTarget({ ...basePlayer, actor, character: null, controlledTokens: [], placeableTokens: [], ownedTokens: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/No token of summoner Gandalf/);
    });

    it('actor set and owned token present → valid', () => {
        const actor = makeActor('actor-1');
        const token = makeToken(actor);
        const result = validateSummonerTarget({ ...basePlayer, actor, character: null, controlledTokens: [], placeableTokens: [], ownedTokens: [token] });
        expect(result.valid).toBe(true);
        expect(result.token).toBe(token);
    });
});
