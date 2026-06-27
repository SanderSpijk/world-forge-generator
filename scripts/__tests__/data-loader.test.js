/**
 * DataLoader unit tests
 * Tests caching, validation, and fallback behavior
 */

import { DataLoader } from '../data-loader.js';
require('./setup.js');

describe('DataLoader', () => {
  beforeEach(() => {
    // Clear cache before each test
    DataLoader._cache.clear();
    fetch.mockClear();
  });

  describe('load()', () => {
    it('should fetch and cache JSON data', async () => {
      const mockData = { races: [{ nl: 'Mensje', en: 'Human' }] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await DataLoader.load('races.json', 'races');
      expect(result).toEqual(mockData.races);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await DataLoader.load('races.json', 'races');
      expect(result2).toEqual(mockData.races);
      expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should return full object when key is null', async () => {
      const mockData = { races: [{ nl: 'Mensje', en: 'Human' }], jobs: [] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await DataLoader.load('races.json');
      expect(result).toEqual(mockData);
    });

    it('should return empty array on fetch error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await DataLoader.load('races.json', 'races');
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty object on fetch error when key is null', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await DataLoader.load('races.json');
      expect(result).toEqual({});
      expect(typeof result).toBe('object');
      expect(Array.isArray(result)).toBe(false);
    });

    it('should validate schema and reject invalid data', async () => {
      // races.json expects array with nl/en fields
      const invalidData = { races: 'not-an-array' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData,
      });

      const result = await DataLoader.load('races.json', 'races');
      expect(result).toEqual([]); // Fallback to empty array
    });

    it('should handle HTTP errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await DataLoader.load('nonexistent.json', 'data');
      expect(result).toEqual([]);
    });

    it('should cache errors to prevent repeated failed requests', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result1 = await DataLoader.load('races.json', 'races');
      fetch.mockRejectedValueOnce(new Error('Network error again'));
      const result2 = await DataLoader.load('races.json', 'races');

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1); // Only called once, cache hit second time
    });
  });

  describe('pick()', () => {
    it('should return random item from array', async () => {
      const mockData = {
        races: [
          { nl: 'Mensje', en: 'Human', weight: 1 },
          { nl: 'Elf', en: 'Elf', weight: 1 },
        ],
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await DataLoader.pick('races.json', 'races');
      expect(result).toBeDefined();
      expect(mockData.races).toContainEqual(result);
    });

    it('should return null for empty array', async () => {
      const mockData = { races: [] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await DataLoader.pick('races.json', 'races');
      expect(result).toBeNull();
    });

    it('should return null on fetch error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await DataLoader.pick('races.json', 'races');
      expect(result).toBeNull();
    });
  });

  describe('invalidate()', () => {
    it('should remove specific cache entry', async () => {
      const mockData = { races: [{ nl: 'Mensje', en: 'Human' }] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await DataLoader.load('races.json', 'races');
      expect(DataLoader._cache.size).toBe(1);

      DataLoader.invalidate('races.json');
      expect(DataLoader._cache.size).toBe(0);
    });

    it('should remove all entries with same path', async () => {
      const mockData = { races: [{ nl: 'Mensje', en: 'Human' }] };
      fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await DataLoader.load('races.json', 'races');
      await DataLoader.load('races.json', 'jobs');
      await DataLoader.load('buildings.json');

      DataLoader.invalidate('races.json');
      expect(DataLoader._cache.size).toBe(1); // Only buildings.json remains
    });

    it('should clear entire cache when called with null', async () => {
      const mockData = { test: [] };
      fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await DataLoader.load('races.json');
      await DataLoader.load('buildings.json');
      expect(DataLoader._cache.size).toBe(2);

      DataLoader.invalidate();
      expect(DataLoader._cache.size).toBe(0);
    });
  });

  describe('Schema Validation', () => {
    it('should validate races.json structure', async () => {
      const validData = {
        races: [
          { nl: 'Mensje', en: 'Human', weight: 1 },
          { nl: 'Elf', en: 'Elf', weight: 1 },
        ],
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validData,
      });

      const result = await DataLoader.load('races.json', 'races');
      expect(result).toEqual(validData.races);
    });

    it('should reject races.json if items missing nl field', async () => {
      const invalidData = {
        races: [{ en: 'Human', weight: 1 }], // missing 'nl'
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData,
      });

      const result = await DataLoader.load('races.json', 'races');
      expect(result).toEqual([]); // Fallback
    });

    it('should validate buildings.json object structure', async () => {
      const validData = {
        dak: [{ nl: 'Tegels', en: 'Tiles', theme: 'medieval' }],
        gebouw: [{ nl: 'Huis', en: 'House', theme: 'medieval' }],
        hoogte: [],
        sfeer: [],
        drukte: [],
        detail_inn: [],
        detail_shop: [],
        bouwmateriaal: [],
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validData,
      });

      const result = await DataLoader.load('buildings.json');
      expect(result).toEqual(validData);
    });

    it('should reject buildings.json if missing required keys', async () => {
      const invalidData = {
        dak: [],
        gebouw: [],
        // missing other required keys
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData,
      });

      const result = await DataLoader.load('buildings.json');
      expect(result).toEqual({}); // Fallback to empty object
    });
  });
});
