/**
 * Integration tests
 * Tests interaction between DataLoader, BaseGenerator, and WorldForgeSettings
 */

import { DataLoader } from '../data-loader.js';
import { BaseGenerator } from '../base-generator.js';
require('./setup.js');

describe('Integration: DataLoader + BaseGenerator', () => {
  beforeEach(() => {
    DataLoader._cache.clear();
    fetch.mockClear();
  });

  it('should load race data and use in generator', async () => {
    const mockRaces = {
      races: [
        { nl: 'Mensje', en: 'Human', weight: 3 },
        { nl: 'Elf', en: 'Elf', weight: 2 },
      ],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRaces,
    });

    // Simulate generator workflow
    const races = await DataLoader.load('races.json', 'races');
    const selected = BaseGenerator.weightedPick(races);

    expect(selected).toBeDefined();
    expect(['Mensje', 'Elf']).toContainEqual(BaseGenerator.L(selected));
  });

  it('should validate loaded data with BaseGenerator.L()', async () => {
    const mockJobs = {
      jobs: [
        { nl: 'Krijger', en: 'Warrior', weight: 1 },
        { nl: 'Tovenaar', en: 'Wizard', weight: 1 },
      ],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockJobs,
    });

    const jobs = await DataLoader.load('jobs.json', 'jobs');
    jobs.forEach((job) => {
      const name = BaseGenerator.L(job);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  it('should handle corrupted data and provide fallback', async () => {
    // Corrupted: array instead of object with 'races' key
    const corruptedData = ['not', 'an', 'object'];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => corruptedData,
    });

    const result = await DataLoader.load('races.json', 'races');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]); // Fallback to empty array
  });

  it('should cache invalidation work with repeated loads', async () => {
    const races1 = {
      races: [{ nl: 'Mensje', en: 'Human', weight: 3 }],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => races1,
    });

    let result = await DataLoader.load('races.json', 'races');
    expect(result[0].nl).toBe('Mensje');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Invalidate and reload with different data
    DataLoader.invalidate('races.json');

    const races2 = {
      races: [
        { nl: 'Elf', en: 'Elf', weight: 2 },
        { nl: 'Dwerg', en: 'Dwarf', weight: 1 },
      ],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => races2,
    });

    result = await DataLoader.load('races.json', 'races');
    expect(result[0].nl).toBe('Elf');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should generate items with proper language support', async () => {
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

    const races = await DataLoader.load('races.json', 'races');
    for (let i = 0; i < 10; i++) {
      const race = BaseGenerator.weightedPick(races);
      const displayName = BaseGenerator.L(race);

      expect(displayName).toBeDefined();
      expect(typeof displayName).toBe('string');
      expect(['Mensje', 'Elf']).toContain(displayName);
    }
  });

  it('should pick correctly from filtered arrays', async () => {
    const mockBuildings = {
      buildings: [
        { nl: 'Huis', en: 'House', theme: 'medieval', weight: 5 },
        { nl: 'Kasteel', en: 'Castle', theme: 'medieval', weight: 2 },
        { nl: 'Pagode', en: 'Pagoda', theme: 'asian', weight: 1 },
      ],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuildings,
    });

    const buildings = await DataLoader.load('buildings.json', 'buildings');

    // Filter to medieval only
    const medieval = buildings.filter((b) => b.theme === 'medieval');
    expect(medieval.length).toBe(2);

    const picked = BaseGenerator.weightedPick(medieval);
    expect(['Huis', 'Kasteel']).toContainEqual(BaseGenerator.L(picked));
  });
});

describe('Integration: Error Recovery', () => {
  beforeEach(() => {
    DataLoader._cache.clear();
    fetch.mockClear();
  });

  it('should recover from partial load failures', async () => {
    // First load fails
    fetch.mockRejectedValueOnce(new Error('Network error'));
    let result = await DataLoader.load('races.json', 'races');
    expect(result).toEqual([]);

    // Second load succeeds from cache
    const data = { races: [{ nl: 'Mensje', en: 'Human', weight: 1 }] };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });

    result = await DataLoader.load('races.json', 'races');
    // Still cached empty array from first failed attempt
    expect(result).toEqual([]);

    // Invalidate and try again
    DataLoader.invalidate('races.json');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });

    result = await DataLoader.load('races.json', 'races');
    expect(result).toEqual(data.races);
  });

  it('should handle sequence of valid, invalid, valid data', async () => {
    const validData = { races: [{ nl: 'Mensje', en: 'Human', weight: 1 }] };
    const invalidData = { races: 'not-an-array' };

    // Load valid
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validData,
    });
    let result = await DataLoader.load('races.json', 'races');
    expect(Array.isArray(result)).toBe(true);

    // Invalidate and load invalid
    DataLoader.invalidate('races.json');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => invalidData,
    });
    result = await DataLoader.load('races.json', 'races');
    expect(result).toEqual([]); // Fallback

    // Invalidate and load valid again
    DataLoader.invalidate('races.json');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validData,
    });
    result = await DataLoader.load('races.json', 'races');
    expect(result).toEqual(validData.races);
  });
});
