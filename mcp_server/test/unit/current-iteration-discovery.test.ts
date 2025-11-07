/**
 * Tests for Current Iteration Path Discovery
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getCurrentIterationPath, getTeamIterations } from '../../src/services/ado-discovery-service.js';
import { createADOHttpClient } from '../../src/utils/ado-http-client.js';

jest.mock('../../src/utils/ado-http-client.js');
jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => async () => 'mock-token')
}));

const mockGet = jest.fn();
const mockHttpClient = {
  get: mockGet
} as any;

(createADOHttpClient as jest.Mock).mockReturnValue(mockHttpClient);

describe('Current Iteration Path Discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentIterationPath', () => {
    it('should extract team name and query current iteration', async () => {
      const mockResponse = {
        data: {
          value: [{
            id: 'iter-123',
            name: 'Sprint 10',
            path: 'MyProject\\Iteration\\Sprint 10',
            attributes: { timeFrame: 'current' }
          }]
        }
      };

      (mockGet as any).mockResolvedValue(mockResponse);

      const result = await getCurrentIterationPath('myorg', 'MyProject', 'MyProject\\TeamName\\Component');

      expect(result).toBe('MyProject\\Iteration\\Sprint 10');
    });

    it('should return null if area path insufficient', async () => {
      const result = await getCurrentIterationPath('myorg', 'MyProject', 'MyProject');
      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      (mockGet as any).mockRejectedValue(new Error('API Error'));
      const result = await getCurrentIterationPath('myorg', 'MyProject', 'MyProject\\Team');
      expect(result).toBeNull();
    });
  });

  describe('getTeamIterations', () => {
    it('should fetch all team iterations', async () => {
      const mockResponse = {
        data: {
          value: [
            { id: '1', name: 'Sprint 9', path: 'P\\I\\S9', attributes: { timeFrame: 'past' } },
            { id: '2', name: 'Sprint 10', path: 'P\\I\\S10', attributes: { timeFrame: 'current' } }
          ]
        }
      };

      (mockGet as any).mockResolvedValue(mockResponse);
      const result = await getTeamIterations('myorg', 'P', 'P\\Team');
      
      expect(result).toHaveLength(2);
      expect(result[1].attributes.timeFrame).toBe('current');
    });
  });
});
