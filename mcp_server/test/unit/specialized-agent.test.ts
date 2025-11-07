/**
 * Unit tests for specialized agent assignment feature
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { assignToCopilotSchema, newCopilotItemSchema } from '../../src/config/schemas.js';

describe('Specialized Agent Assignment Schema', () => {
  describe('assignToCopilotSchema', () => {
    it('should accept valid input with specializedAgent', () => {
      const input = {
        workItemId: 12345,
        repository: 'my-repo',
        branch: 'main',
        specializedAgent: 'ComponentGovernanceAgent'
      };

      const result = assignToCopilotSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specializedAgent).toBe('ComponentGovernanceAgent');
      }
    });

    it('should accept valid input without specializedAgent', () => {
      const input = {
        workItemId: 12345,
        repository: 'my-repo'
      };

      const result = assignToCopilotSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specializedAgent).toBeUndefined();
      }
    });

    it('should reject invalid input (missing workItemId)', () => {
      const input = {
        repository: 'my-repo',
        specializedAgent: 'ComponentGovernanceAgent'
      };

      const result = assignToCopilotSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid input (missing repository)', () => {
      const input = {
        workItemId: 12345,
        specializedAgent: 'ComponentGovernanceAgent'
      };

      const result = assignToCopilotSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('newCopilotItemSchema', () => {
    it('should accept valid input with specializedAgent', () => {
      const input = {
        title: 'Test Work Item',
        parentWorkItemId: 12345,
        repository: 'my-repo',
        specializedAgent: 'ComponentGovernanceAgent'
      };

      const result = newCopilotItemSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specializedAgent).toBe('ComponentGovernanceAgent');
      }
    });

    it('should accept valid input without specializedAgent', () => {
      const input = {
        title: 'Test Work Item',
        parentWorkItemId: 12345,
        repository: 'my-repo'
      };

      const result = newCopilotItemSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specializedAgent).toBeUndefined();
      }
    });

    it('should accept multiple specialized agent names', () => {
      const agentNames = [
        'ComponentGovernanceAgent',
        'SecurityScanAgent',
        'CodeReviewAgent',
        'TestAutomationAgent'
      ];

      agentNames.forEach(agentName => {
        const input = {
          title: 'Test Work Item',
          parentWorkItemId: 12345,
          repository: 'my-repo',
          specializedAgent: agentName
        };

        const result = newCopilotItemSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.specializedAgent).toBe(agentName);
        }
      });
    });

    it('should reject invalid input (missing required fields)', () => {
      const input = {
        title: 'Test Work Item',
        specializedAgent: 'ComponentGovernanceAgent'
        // Missing parentWorkItemId and repository
      };

      const result = newCopilotItemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
