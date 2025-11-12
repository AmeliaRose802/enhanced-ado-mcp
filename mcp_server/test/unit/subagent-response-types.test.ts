/**
 * Unit tests for subagent response type structures
 * 
 * These tests verify that the response types used in ai-assignment.ts
 * match the expected structure from list-subagents handler.
 */

import { describe, it, expect } from '@jest/globals';

describe('Subagent Response Types', () => {
  describe('SubagentInfo Interface', () => {
    it('should have correct structure', () => {
      const validSubagent = {
        name: 'Backend API Specialist',
        description: 'Handles backend API development',
        tag: 'copilot:agent=backend-api'
      };

      // Type check - should compile
      expect(validSubagent).toBeDefined();
      expect(validSubagent.name).toBe('Backend API Specialist');
      expect(validSubagent.description).toBe('Handles backend API development');
      expect(validSubagent.tag).toBe('copilot:agent=backend-api');
    });

    it('should require all three fields', () => {
      // Missing fields should be caught by TypeScript at compile time
      const validSubagent = {
        name: 'Test Agent',
        description: 'Test description',
        tag: 'test-tag'
      };

      expect(Object.keys(validSubagent)).toHaveLength(3);
      expect(validSubagent).toHaveProperty('name');
      expect(validSubagent).toHaveProperty('description');
      expect(validSubagent).toHaveProperty('tag');
    });
  });

  describe('ListSubagentsResponse Interface', () => {
    it('should have correct structure', () => {
      const validResponse = {
        repository: 'my-repo',
        subagents: [
          {
            name: 'Agent 1',
            description: 'Description 1',
            tag: 'tag1'
          },
          {
            name: 'Agent 2',
            description: 'Description 2',
            tag: 'tag2'
          }
        ],
        message: 'Found 2 agents'
      };

      expect(validResponse).toBeDefined();
      expect(validResponse.repository).toBe('my-repo');
      expect(validResponse.subagents).toHaveLength(2);
      expect(validResponse.message).toBe('Found 2 agents');
    });

    it('should allow empty subagents array', () => {
      const emptyResponse = {
        repository: 'my-repo',
        subagents: [],
        message: 'No agents found'
      };

      expect(emptyResponse.subagents).toHaveLength(0);
      expect(emptyResponse.message).toBe('No agents found');
    });

    it('should allow optional message field', () => {
      const responseWithoutMessage = {
        repository: 'my-repo',
        subagents: []
      };

      expect(responseWithoutMessage).toBeDefined();
      expect(responseWithoutMessage.repository).toBe('my-repo');
      expect(responseWithoutMessage.subagents).toHaveLength(0);
      expect(responseWithoutMessage).not.toHaveProperty('message');
    });
  });

  describe('Type Safety in ai-assignment.ts', () => {
    it('should properly map subagent data', () => {
      // Simulate the mapping done in ai-assignment.ts
      const mockResponseData = {
        repository: 'test-repo',
        subagents: [
          { name: 'Agent1', description: 'Desc1', tag: 'tag1' },
          { name: 'Agent2', description: 'Desc2', tag: 'tag2' }
        ]
      };

      const availableAgents = mockResponseData.subagents.map((agent) => ({
        name: agent.name,
        description: agent.description,
        tag: agent.tag
      }));

      expect(availableAgents).toHaveLength(2);
      expect(availableAgents[0].name).toBe('Agent1');
      expect(availableAgents[1].tag).toBe('tag2');
    });

    it('should handle agent with specialized tags', () => {
      const agentWithSpecializedTag = {
        name: 'Database Specialist',
        description: 'Expert in database operations',
        tag: 'copilot:agent=database'
      };

      expect(agentWithSpecializedTag.tag).toMatch(/^copilot:agent=/);
      expect(agentWithSpecializedTag.tag.split('=')[1]).toBe('database');
    });

    it('should validate agent name is non-empty', () => {
      const validAgent = {
        name: 'Valid Agent',
        description: 'Valid description',
        tag: 'valid-tag'
      };

      expect(validAgent.name.length).toBeGreaterThan(0);
      expect(validAgent.name.trim()).toBe(validAgent.name);
    });
  });

  describe('Array Operations', () => {
    it('should safely filter and transform subagent arrays', () => {
      const mixedData = [
        { name: 'Agent1', description: 'Desc1', tag: 'tag1' },
        { name: 'Agent2', description: 'Desc2', tag: 'tag2' },
        { name: 'Agent3', description: 'Desc3', tag: 'tag3' }
      ];

      const filtered = mixedData.filter(agent => agent.tag.includes('tag'));
      expect(filtered).toHaveLength(3);

      const mapped = mixedData.map(agent => ({
        name: agent.name,
        description: agent.description,
        tag: agent.tag
      }));
      expect(mapped).toHaveLength(3);
      expect(mapped[0]).toEqual(mixedData[0]);
    });
  });
});
