/**
 * Mock Foundry environment for testing
 */

// Mock the global Foundry game object
global.game = {
  i18n: {
    localize: (key) => key,
    translations: {},
  },
  modules: {
    get: (name) => {
      if (name === "world-forge-generator") {
        return {
          active: true,
          version: "0.9.3",
          _translations: {
            nl: { "WF.Test": "Test" },
            en: { "WF.Test": "Test" },
          },
        };
      }
      return undefined;
    },
  },
  settings: {
    get: (module, key) => {
      const defaults = {
        "world-forge-generator.generatorLanguage": "nl",
        "world-forge-generator.campaignThemePreset": "medieval",
      };
      return defaults[`${module}.${key}`] ?? null;
    },
  },
  user: { isGM: true },
};

// Mock fetch for DataLoader tests
global.fetch = jest.fn();

module.exports = { game };
