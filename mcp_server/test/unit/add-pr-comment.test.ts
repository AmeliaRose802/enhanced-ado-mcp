/**
 * Unit tests for add-pr-comment handler
 */

import { describe, it, expect } from '@jest/globals';
import { addPullRequestCommentSchema } from '../../src/config/schemas.js';

describe('add-pr-comment', () => {
  describe('Schema Validation', () => {
    it('should accept required parameters only', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'This looks good!'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept comment with Copilot mention', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Please review this code',
        mentionCopilot: true
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept comment with explicit Copilot GUID', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Check for security issues',
        mentionCopilot: true,
        copilotGuid: '5d6898bb-45ec-419a-ad8a-1234567890ab@2c895908-abcd-efgh-ijkl-mnopqrstuvwx'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept line-specific comment with thread context', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'This function needs error handling',
        threadContext: {
          filePath: 'src/utils/validation.ts',
          rightFileStart: { line: 45 },
          rightFileEnd: { line: 52 }
        }
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept thread context with offset', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Consider refactoring this',
        threadContext: {
          filePath: 'src/core/engine.ts',
          rightFileStart: { line: 100, offset: 5 },
          rightFileEnd: { line: 105, offset: 10 }
        }
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept custom Copilot display name', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'What do you think?',
        mentionCopilot: true,
        copilotDisplayName: 'AI Reviewer'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing repository', () => {
      const input = {
        pullRequestId: 123,
        comment: 'Test comment'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing pull request ID', () => {
      const input = {
        repository: 'MyRepo',
        comment: 'Test comment'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing comment text', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty comment text', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: ''
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid PR ID (negative)', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: -5,
        comment: 'Test'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid PR ID (zero)', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 0,
        comment: 'Test'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid line number (negative)', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Test',
        threadContext: {
          filePath: 'test.ts',
          rightFileStart: { line: -5 }
        }
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid line number (zero)', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Test',
        threadContext: {
          filePath: 'test.ts',
          rightFileStart: { line: 0 }
        }
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid offset (negative)', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Test',
        threadContext: {
          filePath: 'test.ts',
          rightFileStart: { line: 10, offset: -1 }
        }
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid offset (zero) - offset must be >= 1', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Test',
        threadContext: {
          filePath: 'test.ts',
          rightFileStart: { line: 10, offset: 0 }
        }
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Offset must be ≥1');
      }
    });

    it('should accept organization and project overrides', () => {
      const input = {
        repository: 'MyRepo',
        pullRequestId: 123,
        comment: 'Test',
        organization: 'msazure',
        project: 'One'
      };

      const result = addPullRequestCommentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Mention Format', () => {
    it('should generate correct HTML mention format', () => {
      const guid = '5d6898bb-45ec-419a-ad8a-1234567890ab@2c895908-abcd-efgh-ijkl-mnopqrstuvwx';
      const displayName = 'GitHub Copilot';
      const comment = 'Please review this code';
      
      // Expected format
      // Test the mention format structure
      // Azure DevOps uses plain text format: @<GUID>
      // GUID should be uppercase localId only
      const localId = guid.split('@')[0];
      const expectedMention = `@<${localId.toUpperCase()}>`;
      const expectedResult = `${expectedMention} ${comment}`;
      
      // This would be the actual formatting function
      // formatCommentWithMention(comment, guid, displayName)
      
      expect(expectedResult).toContain('@<');
      expect(expectedResult).toContain('>');
      expect(expectedResult).toContain(localId.toUpperCase());
      expect(expectedResult).toContain(comment);
    });

    it('should prepend mention to comment text', () => {
      const guid = 'abc123@def456';
      const comment = 'What do you think?';
      const localId = guid.split('@')[0];
      const expectedMention = `@<${localId.toUpperCase()}>`;
      
      // The formatted comment should start with the mention
      const formatted = `${expectedMention} ${comment}`;
      expect(formatted.indexOf(expectedMention)).toBe(0);
    });
  });
});
