# WorldForge Test Suite

Unit and integration tests for WorldForge VTT module infrastructure.

## Running Tests

```bash
# Install dependencies (one time)
npm install

# Run all tests
npm test

# Run tests in watch mode (re-run on file change)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

Current test suite covers:

### DataLoader (`data-loader.test.js`)
- ✅ Fetch and caching
- ✅ Key-based lookups
- ✅ Error handling (network, HTTP errors)
- ✅ Fallback behavior (empty array/object)
- ✅ Cache invalidation
- ✅ Schema validation (races, buildings, etc.)
- ✅ Random picking with `pick()`

**Coverage**: ~85% of DataLoader code

### BaseGenerator (`base-generator.test.js`)
- ✅ L() language-aware lookups
- ✅ weightedPick() distribution
- ✅ lang getter
- ✅ Subclass interface compliance
- ✅ Error handling (null values, malformed objects)

**Coverage**: ~75% of BaseGenerator code

### WorldForgeSettings (`worldforge-settings.test.js`)
- ✅ Translation retrieval with t()
- ✅ Flag management (comfyAvailable, codexAvailable)
- ✅ Language property
- ✅ Translation loading from init hook

**Coverage**: ~60% of WorldForgeSettings code

### Integration Tests (`integration.test.js`)
- ✅ DataLoader + BaseGenerator workflow
- ✅ Language support with real data
- ✅ Error recovery and fallback
- ✅ Cache invalidation with data changes
- ✅ Filtered array picking

## Test Structure

```
scripts/__tests__/
├── setup.js                    # Mock Foundry game object
├── data-loader.test.js         # DataLoader tests (40+ assertions)
├── base-generator.test.js      # BaseGenerator tests (25+ assertions)
├── worldforge-settings.test.js # Settings tests (15+ assertions)
├── integration.test.js         # Integration tests (15+ assertions)
└── README.md                   # This file
```

## Mocking

All tests use a mock Foundry game object defined in `setup.js`. Key mocked features:

```javascript
global.game = {
  i18n: { localize, translations },
  modules: { get() },
  settings: { get() },
  user: { isGM: true },
};

global.fetch = jest.fn(); // Mocked for DataLoader tests
```

## Coverage Threshold

Jest is configured to enforce minimum coverage:
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

Run `npm run test:coverage` to see current coverage.

## Writing New Tests

1. **Location**: Add `.test.js` files in `scripts/__tests__/`
2. **Structure**:
   ```javascript
   import { Component } from '../component.js';
   require('./setup.js'); // Load mocks

   describe('ComponentName', () => {
     it('should do something', () => {
       // Arrange
       // Act
       // Assert
     });
   });
   ```

3. **Mocking fetch**: 
   ```javascript
   fetch.mockResolvedValueOnce({ ok: true, json: async () => data });
   // or
   fetch.mockRejectedValueOnce(new Error('Failed'));
   ```

## Common Issues

- **"Cannot find module" errors**: Ensure Node.js resolves ES6 imports. Jest is configured with `transform: {}` to use native Node.js modules.
- **"game is not defined"**: Make sure `require('./setup.js')` is called in test file.
- **Async tests**: Use `async () => { ... }` and `await` or return promises.

## CI/CD Integration

To integrate into CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test -- --coverage --watchAll=false
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Future Test Coverage

Remaining components to test:
- [ ] Campaign Codex integration (CC)
- [ ] Specific generators (NPC, Shop, City, etc.)
- [ ] HTML rendering (xss/escaping)
- [ ] ComfyUI integration
- [ ] PDF export
