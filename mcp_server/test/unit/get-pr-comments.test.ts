/**
 * Unit tests for get-pr-comments handler
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import type { ToolConfig } from '../../src/types/index.js';
import { getPullRequestCommentsSchema } from '../../src/config/schemas.js';

describe('get-pr-comments', () => {
  describe('Schema Validation', () => {
    it('should accept natural language description', () => {
      const input = {
        description: 'Show active threads from PRs targeting main in the last week',
        repository: 'MyRepo'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept specific PR mode', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept explicit search filters', () => {
      const input = {
        repository: 'MyRepo',
        status: 'active',
        targetRefName: 'refs/heads/main',
        minTime: '2025-11-01T00:00:00Z',
        threadStatusFilter: ['active', 'pending']
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate thread status filter values', () => {
      const validStatuses = ['unknown', 'active', 'fixed', 'wontFix', 'closed', 'byDesign', 'pending'];
      
      for (const status of validStatuses) {
        const input = {
          threadStatusFilter: [status]
        };
        const result = getPullRequestCommentsSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid thread status', () => {
      const input = {
        threadStatusFilter: ['invalid-status']
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate PR status enum', () => {
      const validStatuses = ['active', 'abandoned', 'completed', 'notSet', 'all'];
      
      for (const status of validStatuses) {
        const input = {
          status: status as any
        };
        const result = getPullRequestCommentsSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid PR status', () => {
      const input = {
        status: 'invalid-status'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept pagination parameters', () => {
      const input = {
        repository: 'MyRepo',
        maxPRsToFetch: 20,
        top: 100,
        skip: 50
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate maxPRsToFetch range', () => {
      const tooHigh = {
        maxPRsToFetch: 101
      };
      expect(getPullRequestCommentsSchema.safeParse(tooHigh).success).toBe(false);

      const tooLow = {
        maxPRsToFetch: 0
      };
      expect(getPullRequestCommentsSchema.safeParse(tooLow).success).toBe(false);

      const valid = {
        maxPRsToFetch: 50
      };
      expect(getPullRequestCommentsSchema.safeParse(valid).success).toBe(true);
    });

    it('should accept boolean flags', () => {
      const input = {
        includeSystemComments: true,
        includeDeleted: true
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept organization and project overrides', () => {
      const input = {
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepo'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Parameter Combinations', () => {
    it('should allow description without pullRequestId (AI mode)', () => {
      const input = {
        description: 'Find unresolved comments'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow pullRequestId without description (specific mode)', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 456
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow explicit filters without description (search mode)', () => {
      const input = {
        repository: 'MyRepo',
        status: 'completed',
        minTime: '2025-11-01T00:00:00Z'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow thread filters with any mode', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        threadStatusFilter: ['active', 'pending']
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Date Format', () => {
    it('should accept valid ISO date strings', () => {
      const input = {
        minTime: '2025-11-01T00:00:00Z',
        maxTime: '2025-11-30T23:59:59Z'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Branch Reference Format', () => {
    it('should accept full ref names', () => {
      const input = {
        sourceRefName: 'refs/heads/feature/my-branch',
        targetRefName: 'refs/heads/main'
      };

      const result = getPullRequestCommentsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
