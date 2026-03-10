import { vi } from 'vitest';

// Mock all Foundry VTT globals so the module scripts can be imported in Node.js

global.game = {
    actors: { contents: [], get: vi.fn(() => null) },
    combat: null,
    time: { worldTime: 0 },
    packs: { get: vi.fn(() => null) },
    folders: { getName: vi.fn(() => null) },
    user: { isGM: false },
    userId: 'test-user',
};

global.canvas = {
    tokens: { placeables: [], get: vi.fn(() => null) },
    scene: null,
};

global.ui = {
    notifications: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
};

global.Roll = class {
    constructor(formula) {
        this.formula = formula;
    }
    static validate() {
        return true;
    }
    async evaluate() {
        return { total: 1 };
    }
    async roll() {
        return { total: 1, formula: this.formula };
    }
};

global.Actor = {
    create: vi.fn(async () => ({ id: 'test-actor-id' })),
};

global.ChatMessage = {
    create: vi.fn(),
};

global.Folder = {
    create: vi.fn(async () => ({ id: 'test-folder-id' })),
};

global.Hooks = {
    on: vi.fn(() => 1),
    once: vi.fn(),
};

global.foundry = {
    utils: {
        duplicate: (o) => JSON.parse(JSON.stringify(o)),
    },
};

global.CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 },
};

// expiration-tracker.js uses window._ properties for hook IDs
global.window = global;
