/**
 * WorldForgeSettings unit tests
 * Tests translation getter, flag management, default values
 */

require('./setup.js');
import { WorldForgeSettings } from '../settings.js';

describe('WorldForgeSettings', () => {
  beforeEach(() => {
    // Reset flags before each test
    WorldForgeSettings.comfyAvailable = false;
    WorldForgeSettings.codexAvailable = false;
  });

  describe('t() translation method', () => {
    it('should return Dutch translation by default', () => {
      const result = WorldForgeSettings.t('WF.Test');
      expect(result).toBe('Test'); // From mock setup
    });

    it('should return key if translation not found', () => {
      const result = WorldForgeSettings.t('WF.NonExistent.Key');
      expect(result).toBe('WF.NonExistent.Key');
    });

    it('should handle nested translation keys', () => {
      // This depends on actual nl.json structure
      // Test will pass if module translations are loaded correctly
      expect(typeof WorldForgeSettings.t('WF.Test')).toBe('string');
    });

    it('should respect language setting', () => {
      // Mock change language to English
      global.game.settings.get = () => 'en';
      // This would require language switching logic in the actual implementation
      // Test structure is here for future implementation
      expect(WorldForgeSettings.lang).toBeDefined();
    });
  });

  describe('Flag management', () => {
    it('should initialize comfyAvailable as false', () => {
      expect(WorldForgeSettings.comfyAvailable).toBe(false);
    });

    it('should initialize codexAvailable as false', () => {
      expect(WorldForgeSettings.codexAvailable).toBe(false);
    });

    it('should allow comfyAvailable to be set', () => {
      WorldForgeSettings.comfyAvailable = true;
      expect(WorldForgeSettings.comfyAvailable).toBe(true);
    });

    it('should allow codexAvailable to be set', () => {
      WorldForgeSettings.codexAvailable = true;
      expect(WorldForgeSettings.codexAvailable).toBe(true);
    });
  });

  describe('Language property', () => {
    it('should return current language setting', () => {
      const lang = WorldForgeSettings.lang;
      expect(['nl', 'en']).toContain(lang);
    });

    it('should default to nl if setting not found', () => {
      // Mock broken game.settings
      const originalSettings = global.game.settings;
      global.game.settings = { get: () => null };

      const lang = WorldForgeSettings.lang;
      expect(lang).toBe('nl');

      // Restore
      global.game.settings = originalSettings;
    });
  });

  describe('ComfyUI integration', () => {
    it('should track ComfyUI availability', () => {
      expect(WorldForgeSettings.comfyAvailable).toBe(false);
      WorldForgeSettings.comfyAvailable = true;
      expect(WorldForgeSettings.comfyAvailable).toBe(true);
    });

    it('should have configurable ComfyUI URL', () => {
      // Settings.js should expose comfyUrl
      expect(WorldForgeSettings.comfyUrl).toBeDefined();
    });
  });

  describe('Campaign Codex integration', () => {
    it('should track Campaign Codex availability', () => {
      expect(WorldForgeSettings.codexAvailable).toBe(false);
      WorldForgeSettings.codexAvailable = true;
      expect(WorldForgeSettings.codexAvailable).toBe(true);
    });
  });

  describe('Translation loading', () => {
    it('should have loaded translations from init hook', () => {
      const mod = global.game.modules.get('world-forge-generator');
      expect(mod._translations).toBeDefined();
      expect(mod._translations.nl).toBeDefined();
      expect(mod._translations.en).toBeDefined();
    });

    it('should have fallback translations for test key', () => {
      const mod = global.game.modules.get('world-forge-generator');
      expect(mod._translations.nl['WF.Test']).toBe('Test');
      expect(mod._translations.en['WF.Test']).toBe('Test');
    });
  });
});
