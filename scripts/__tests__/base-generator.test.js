/**
 * BaseGenerator unit tests
 * Tests L() language-aware lookups, weightedPick(), lang getter
 */

import { BaseGenerator } from '../base-generator.js';
require('./setup.js');

describe('BaseGenerator', () => {
  describe('L() method', () => {
    it('should return language-specific text from object', () => {
      const obj = { nl: 'Mensje', en: 'Human' };
      const result = BaseGenerator.L(obj);
      // Default language is 'nl' per WorldForgeSettings
      expect(result).toBe('Mensje');
    });

    it('should fallback to "nl" if specified language not available', () => {
      const obj = { en: 'Human' };
      const result = BaseGenerator.L(obj);
      expect(result).toBe(''); // 'nl' not in object, en not checked as fallback per current logic
    });

    it('should return string as-is if passed primitive', () => {
      const result = BaseGenerator.L('Plain text');
      expect(result).toBe('Plain text');
    });

    it('should return empty string for null/undefined', () => {
      expect(BaseGenerator.L(null)).toBe('');
      expect(BaseGenerator.L(undefined)).toBe('');
    });

    it('should handle nested language objects', () => {
      const nested = {
        nl: 'Mensje',
        en: 'Human',
        extra: 'data',
      };
      const result = BaseGenerator.L(nested);
      expect(result).toBe('Mensje');
    });
  });

  describe('weightedPick() method', () => {
    it('should pick from weighted array', () => {
      const items = [
        { name: 'rare', weight: 1 },
        { name: 'common', weight: 10 },
      ];
      const results = new Map();

      // Run 1000 times to test distribution
      for (let i = 0; i < 1000; i++) {
        const pick = BaseGenerator.weightedPick(items);
        results.set(pick.name, (results.get(pick.name) ?? 0) + 1);
      }

      // Common should be picked ~10x more often than rare
      const commonCount = results.get('common') ?? 0;
      const rareCount = results.get('rare') ?? 0;

      expect(commonCount).toBeGreaterThan(rareCount);
      expect(commonCount).toBeGreaterThan(700); // Should be ~900/1100 picks
      expect(rareCount).toBeLessThan(200);      // Should be ~100/1100 picks
    });

    it('should return null for empty array', () => {
      const result = BaseGenerator.weightedPick([]);
      expect(result).toBeNull();
    });

    it('should handle single item', () => {
      const items = [{ name: 'only', weight: 1 }];
      const result = BaseGenerator.weightedPick(items);
      expect(result).toEqual(items[0]);
    });

    it('should handle items with weight 0', () => {
      const items = [
        { name: 'impossible', weight: 0 },
        { name: 'certain', weight: 1 },
      ];
      const result = BaseGenerator.weightedPick(items);
      expect(result.name).toBe('certain');
    });

    it('should handle equal weights', () => {
      const items = [
        { name: 'a', weight: 1 },
        { name: 'b', weight: 1 },
        { name: 'c', weight: 1 },
      ];
      const results = new Map();

      for (let i = 0; i < 300; i++) {
        const pick = BaseGenerator.weightedPick(items);
        results.set(pick.name, (results.get(pick.name) ?? 0) + 1);
      }

      // All should have roughly equal distribution
      const aCount = results.get('a') ?? 0;
      const bCount = results.get('b') ?? 0;
      const cCount = results.get('c') ?? 0;

      expect(Math.abs(aCount - bCount)).toBeLessThan(50);
      expect(Math.abs(bCount - cCount)).toBeLessThan(50);
    });
  });

  describe('lang getter', () => {
    it('should return current language from WorldForgeSettings', () => {
      const lang = BaseGenerator.lang;
      expect(lang).toBe('nl'); // Default from mock setup
    });
  });

  describe('Generator interface', () => {
    // Test that subclasses can properly extend BaseGenerator
    class TestGenerator extends BaseGenerator {
      static codexType = 'test';
      static folder = '_Test';

      static async generate() {
        return {
          name: { nl: 'Test Item', en: 'Test Item' },
          type: 'test',
        };
      }

      static render(item) {
        return `<div>${BaseGenerator.L(item.name)}</div>`;
      }

      static getName(item) {
        return BaseGenerator.L(item.name);
      }
    }

    it('should allow subclass to implement generate()', async () => {
      const item = await TestGenerator.generate();
      expect(item.type).toBe('test');
      expect(item.name.nl).toBe('Test Item');
    });

    it('should allow subclass to use inherited L() in render()', () => {
      const item = { name: { nl: 'Test', en: 'Test' } };
      const html = TestGenerator.render(item);
      expect(html).toContain('Test');
    });

    it('should allow subclass to use inherited L() in getName()', () => {
      const item = { name: { nl: 'Test Item', en: 'Test Item' } };
      const name = TestGenerator.getName(item);
      expect(name).toBe('Test Item');
    });

    it('should provide codexType and folder static props', () => {
      expect(TestGenerator.codexType).toBe('test');
      expect(TestGenerator.folder).toBe('_Test');
    });
  });

  describe('Error handling', () => {
    it('L() should not throw on malformed objects', () => {
      expect(() => {
        BaseGenerator.L({ nl: null });
      }).not.toThrow();
    });

    it('weightedPick() should not throw on non-array', () => {
      expect(() => {
        BaseGenerator.weightedPick(null);
      }).not.toThrow();
    });

    it('weightedPick() should handle negative weights gracefully', () => {
      const items = [
        { name: 'a', weight: -1 },
        { name: 'b', weight: 10 },
      ];
      const result = BaseGenerator.weightedPick(items);
      expect(result).toBeDefined();
    });
  });
});
