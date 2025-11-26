/**
 * Mock for 'open' package to avoid ESM import issues in Jest
 */

import { jest } from '@jest/globals';

export default jest.fn(() => Promise.resolve());
