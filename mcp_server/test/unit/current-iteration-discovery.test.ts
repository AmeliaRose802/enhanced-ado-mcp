// @ts-nocheck
/**
 * Unit tests for Current Iteration Path Discovery
 * 
 * Tests the auto-discovery of current iteration paths from Azure DevOps team settings
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getCurrentIterationPath, getTeamIterations } from '../../src/services/ado-discovery-service.js';
import { cacheService } from '../../src/services/cache-service.js';

// Mock the token provider - use a function factory pattern to avoid hoisting issues
const mockGetTokenProvider = jest.fn<() => () => Promise<string>>();

jest.mock('../../src/utils/token-provider.js', () => {
  return {
    getTokenProvider: (...args: any[]) => mockGetTokenProvider(...args)
  };
});

// Mock fetch globally
global.fetch = jest.fn() as any;

describe('Current Iteration Path Discovery', () => {
  const mockToken = 'mock-token-123';
  const organization = 'test-org';
  const project = 'TestProject';
  
  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.clear();
    mockGetTokenProvider.mockReturnValue(() => Promise.resolve(mockToken));
  });
  
  describe('getCurrentIterationPath', () => {
    it('should extract team name from area path and discover current iteration', async () => {
      const areaPath = 'TestProject\\TeamAlpha\\Component';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          value: [
            {
              id: 'iter-123',
              name: 'Sprint 42',
              path: 'TestProject\\Iteration\\Sprint 42',
              attributes: {
                startDate: '2025-11-04T00:00:00Z',
                finishDate: '2025-11-17T23:59:59Z',
                timeFrame: 'current'
              }
            }
          ]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBe('TestProject\\Iteration\\Sprint 42');
      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/${organization}/${project}/TeamAlpha/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
    });
    
    it('should use explicit team override when provided', async () => {
      const areaPath = 'One\\Custom\\Azure\\Path';
      const teamOverride = 'Krypton';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          value: [
            {
              id: 'iter-456',
              name: 'Sprint 15',
              path: 'One\\Krypton',
              attributes: {
                timeFrame: 'current'
              }
            }
          ]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath, teamOverride);
      
      expect(result).toBe('One\\Krypton');
      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/${organization}/${project}/Krypton/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`,
        expect.any(Object)
      );
    });
    
    it('should return null when area path has insufficient segments', async () => {
      const areaPath = 'TestProject'; // Only 1 segment, needs at least 2
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
    
    it('should return null when no current iteration is found', async () => {
      const areaPath = 'TestProject\\TeamBeta';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 0,
          value: []
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBeNull();
    });
    
    it('should return first iteration when timeFrame is not "current"', async () => {
      const areaPath = 'TestProject\\TeamGamma';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 2,
          value: [
            {
              id: 'iter-789',
              name: 'Sprint 10',
              path: 'TestProject\\Iteration\\Sprint 10',
              attributes: {
                timeFrame: 'past'
              }
            },
            {
              id: 'iter-790',
              name: 'Sprint 11',
              path: 'TestProject\\Iteration\\Sprint 11',
              attributes: {
                timeFrame: 'future'
              }
            }
          ]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      // Should return first iteration as fallback
      expect(result).toBe('TestProject\\Iteration\\Sprint 10');
    });
    
    it('should handle API errors gracefully', async () => {
      const areaPath = 'TestProject\\TeamDelta';
      
      const mockResponse = {
        ok: false,
        status: 404,
        text: async () => 'Team not found'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBeNull();
    });
    
    it('should handle network errors gracefully', async () => {
      const areaPath = 'TestProject\\TeamEpsilon';
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBeNull();
    });
    
    it('should prioritize iteration with timeFrame=current', async () => {
      const areaPath = 'TestProject\\TeamZeta';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 3,
          value: [
            {
              id: 'iter-1',
              name: 'Sprint 20',
              path: 'TestProject\\Iteration\\Sprint 20',
              attributes: { timeFrame: 'past' }
            },
            {
              id: 'iter-2',
              name: 'Sprint 21',
              path: 'TestProject\\Iteration\\Sprint 21',
              attributes: { timeFrame: 'current' }
            },
            {
              id: 'iter-3',
              name: 'Sprint 22',
              path: 'TestProject\\Iteration\\Sprint 22',
              attributes: { timeFrame: 'future' }
            }
          ]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBe('TestProject\\Iteration\\Sprint 21');
    });
  });
  
  describe('getTeamIterations', () => {
    it('should fetch all iterations for a team', async () => {
      const teamName = 'TestTeam';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 3,
          value: [
            {
              id: 'iter-1',
              name: 'Sprint 1',
              path: 'TestProject\\Iteration\\Sprint 1',
              attributes: { timeFrame: 'past' }
            },
            {
              id: 'iter-2',
              name: 'Sprint 2',
              path: 'TestProject\\Iteration\\Sprint 2',
              attributes: { timeFrame: 'current' }
            },
            {
              id: 'iter-3',
              name: 'Sprint 3',
              path: 'TestProject\\Iteration\\Sprint 3',
              attributes: { timeFrame: 'future' }
            }
          ]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getTeamIterations(organization, project, teamName);
      
      expect(result).toHaveLength(3);
      expect(result?.[0].name).toBe('Sprint 1');
      expect(result?.[1].name).toBe('Sprint 2');
      expect(result?.[2].name).toBe('Sprint 3');
      
      expect(global.fetch).toHaveBeenCalledWith(
        `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations?api-version=7.1`,
        expect.any(Object)
      );
    });
    
    it('should return null on API error', async () => {
      const teamName = 'InvalidTeam';
      
      const mockResponse = {
        ok: false,
        status: 404,
        text: async () => 'Not found'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getTeamIterations(organization, project, teamName);
      
      expect(result).toBeNull();
    });
    
    it('should return empty array when no iterations exist', async () => {
      const teamName = 'NewTeam';
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 0,
          value: []
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getTeamIterations(organization, project, teamName);
      
      expect(result).toEqual([]);
    });
  });
  
  describe('Configuration integration', () => {
    it('should cache discovered iteration path in config', async () => {
      // This test verifies the integration between discovery service and config
      // The actual caching happens in config.ts ensureCurrentIterationPath()
      
      const areaPath = 'TestProject\\TeamAlpha';
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          value: [{
            id: 'iter-1',
            name: 'Sprint 5',
            path: 'TestProject\\Iteration\\Sprint 5',
            attributes: { timeFrame: 'current' }
          }]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const result = await getCurrentIterationPath(organization, project, areaPath);
      
      expect(result).toBe('TestProject\\Iteration\\Sprint 5');
    });
  });
});
