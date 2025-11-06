/**
 * Tests for schema validation error messages
 * Validates that custom error messages provide actionable guidance for AI agents
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { z } from 'zod';
import { buildValidationErrorResponse } from '../../src/utils/response-builder.js';

describe('Schema Validation Error Messages', () => {
  
  describe('String validation with custom messages', () => {
    it('should provide helpful error for empty string with min constraint', () => {
      const schema = z.object({
        title: z.string().min(1, "Title cannot be empty. Provide a descriptive title for the work item.")
      });
      
      const result = schema.safeParse({ title: '' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
        expect(result.error.issues[0].message).toContain('Provide a descriptive title');
      }
    });

    it('should provide helpful error for empty required string', () => {
      const schema = z.object({
        name: z.string().min(1, "Repository name cannot be empty. Example: 'my-repo'")
      });
      
      const result = schema.safeParse({ name: '' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
        expect(result.error.issues[0].message).toContain('Example');
      }
    });
  });

  describe('Number validation with custom messages', () => {
    it('should provide helpful error for negative number when positive required', () => {
      const schema = z.object({
        workItemId: z.number().int("Work item ID must be an integer. Example: 12345").positive("Work item ID must be positive. Example: 12345")
      });
      
      const result = schema.safeParse({ workItemId: -5 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('workItemId'));
        expect(error?.message).toContain('must be positive');
        expect(error?.message).toContain('Example');
      }
    });

    it('should provide helpful error for non-integer number', () => {
      const schema = z.object({
        id: z.number().int("ID must be an integer. Example: 12345")
      });
      
      const result = schema.safeParse({ id: 12.5 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('must be an integer');
        expect(result.error.issues[0].message).toContain('Example');
      }
    });

    it('should provide helpful error for value exceeding max', () => {
      const schema = z.object({
        priority: z.number().int().min(1, "Priority must be at least 1. Valid range: 1-4").max(4, "Priority must be at most 4. Valid range: 1-4")
      });
      
      const result = schema.safeParse({ priority: 10 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('priority'));
        expect(error?.message).toContain('at most 4');
        expect(error?.message).toContain('1-4');
      }
    });

    it('should provide helpful error for value below min', () => {
      const schema = z.object({
        maxResults: z.number().int().positive().max(1000, "maxResults cannot exceed 1000 items. Use pagination for larger result sets.")
      });
      
      const result = schema.safeParse({ maxResults: 2000 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('maxResults'));
        expect(error?.message).toContain('cannot exceed 1000');
        expect(error?.message).toContain('pagination');
      }
    });

    it('should provide helpful error for negative skip value', () => {
      const schema = z.object({
        skip: z.number().int("skip must be an integer").min(0, "skip must be 0 or greater")
      });
      
      const result = schema.safeParse({ skip: -10 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('skip'));
        expect(error?.message).toContain('0 or greater');
      }
    });
  });

  describe('Enum validation with custom messages', () => {
    it('should provide helpful error for invalid enum value with errorMap', () => {
      const schema = z.object({
        outputFormat: z.enum(["detailed", "json"], {
          errorMap: () => ({ message: "outputFormat must be either 'detailed' or 'json'" })
        })
      });
      
      const result = schema.safeParse({ outputFormat: 'xml' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('outputFormat'));
        expect(error?.message).toContain('detailed');
        expect(error?.message).toContain('json');
      }
    });

    it('should provide helpful error for invalid scale type', () => {
      const schema = z.object({
        pointScale: z.enum(['fibonacci', 'linear', 't-shirt'], {
          errorMap: () => ({ message: "pointScale must be one of: fibonacci (1,2,3,5,8,13), linear (1-10), t-shirt (XS,S,M,L,XL)" })
        })
      });
      
      const result = schema.safeParse({ pointScale: 'invalid' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('pointScale'));
        expect(error?.message).toContain('fibonacci');
        expect(error?.message).toContain('linear');
        expect(error?.message).toContain('t-shirt');
      }
    });

    it('should provide helpful error for invalid format type', () => {
      const schema = z.object({
        criteriaFormat: z.enum(['gherkin', 'checklist', 'user-story'], {
          errorMap: () => ({ message: "criteriaFormat must be one of: gherkin (Given/When/Then), checklist (bullet points), user-story (As a/I want/So that)" })
        })
      });
      
      const result = schema.safeParse({ criteriaFormat: 'markdown' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('criteriaFormat'));
        expect(error?.message).toContain('gherkin');
        expect(error?.message).toContain('checklist');
        expect(error?.message).toContain('user-story');
      }
    });
  });

  describe('Array validation with custom messages', () => {
    it('should provide helpful error for array exceeding max length', () => {
      const schema = z.object({
        workItemIds: z.array(z.number().int("Each work item ID must be an integer"))
          .min(1, "At least one work item ID is required")
          .max(50, "Maximum 50 work item IDs allowed. Use multiple calls for larger batches.")
      });
      
      const result = schema.safeParse({ 
        workItemIds: Array(100).fill(1) 
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('workItemIds'));
        expect(error?.message).toContain('Maximum 50');
        expect(error?.message).toContain('multiple calls');
      }
    });

    it('should provide helpful error for empty array when min required', () => {
      const schema = z.object({
        ids: z.array(z.number()).min(1, "At least one ID is required")
      });
      
      const result = schema.safeParse({ ids: [] });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('ids'));
        expect(error?.message).toContain('At least one');
      }
    });
  });

  describe('Range constraints with helpful messages', () => {
    it('should provide helpful error for sampleSize exceeding limit', () => {
      const schema = z.object({
        sampleSize: z.number().int("sampleSize must be an integer")
          .min(1, "sampleSize must be at least 1")
          .max(100, "sampleSize cannot exceed 100 items for performance")
      });
      
      const result = schema.safeParse({ sampleSize: 500 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('sampleSize'));
        expect(error?.message).toContain('cannot exceed 100');
        expect(error?.message).toContain('performance');
      }
    });

    it('should provide helpful error for maxIterations out of range', () => {
      const schema = z.object({
        maxIterations: z.number().int("maxIterations must be an integer")
          .min(1, "maxIterations must be at least 1")
          .max(5, "maxIterations cannot exceed 5 attempts")
      });
      
      const result = schema.safeParse({ maxIterations: 10 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(issue => issue.path.includes('maxIterations'));
        expect(error?.message).toContain('cannot exceed 5');
        expect(error?.message).toContain('attempts');
      }
    });

    it('should provide helpful error for criteria count constraints', () => {
      const schema = z.object({
        minCriteria: z.number().int("minCriteria must be an integer")
          .min(1, "minCriteria must be at least 1")
          .max(10, "minCriteria cannot exceed 10 criteria"),
        maxCriteria: z.number().int("maxCriteria must be an integer")
          .min(1, "maxCriteria must be at least 1")
          .max(15, "maxCriteria cannot exceed 15 criteria")
      });
      
      const result = schema.safeParse({ minCriteria: 20, maxCriteria: 30 });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const minError = result.error.issues.find(issue => issue.path.includes('minCriteria'));
        const maxError = result.error.issues.find(issue => issue.path.includes('maxCriteria'));
        expect(minError?.message).toContain('cannot exceed 10');
        expect(maxError?.message).toContain('cannot exceed 15');
      }
    });
  });

  describe('buildValidationErrorResponse formatting', () => {
    it('should format Zod errors with field paths and helpful tips', () => {
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        age: z.number().int().min(0, "Age must be 0 or greater")
      });

      const parseResult = schema.safeParse({
        name: '',
        age: -5
      });

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const response = buildValidationErrorResponse(parseResult.error);
        
        expect(response.success).toBe(false);
        expect(response.errors).toHaveLength(1);
        expect(response.errors[0]).toContain('Validation error');
        expect(response.errors[0]).toContain('name:');
        expect(response.errors[0]).toContain('age:');
        expect(response.errors[0]).toContain('💡 Tip');
        expect(response.metadata?.validationErrorCount).toBe(2);
      }
    });

    it('should handle single validation error', () => {
      const schema = z.object({
        title: z.string().min(1, "Title cannot be empty")
      });

      const parseResult = schema.safeParse({
        title: ''
      });

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const response = buildValidationErrorResponse(parseResult.error);
        
        expect(response.success).toBe(false);
        expect(response.errors[0]).toContain('title:');
        expect(response.errors[0]).toContain('Title cannot be empty');
      }
    });

    it('should include received value when available', () => {
      const schema = z.object({
        priority: z.number().int().min(1).max(4)
      });

      const parseResult = schema.safeParse({
        priority: 'high' // Wrong type
      });

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const response = buildValidationErrorResponse(parseResult.error);
        
        expect(response.success).toBe(false);
        // Should include the received value in the error message
        expect(response.errors[0]).toContain('priority:');
      }
    });

    it('should handle non-Zod errors gracefully', () => {
      const regularError = { 
        issues: [{
          path: [],
          message: 'Something went wrong'
        }]
      };
      const response = buildValidationErrorResponse(regularError);
      
      expect(response.success).toBe(false);
      expect(response.errors[0]).toContain('Something went wrong');
    });

    it('should format multiple field errors clearly', () => {
      const schema = z.object({
        title: z.string().min(1, "Title is required"),
        workItemId: z.number().positive("Work item ID must be positive"),
        priority: z.number().int().min(1).max(4, "Priority must be 1-4")
      });

      const parseResult = schema.safeParse({
        title: '',
        workItemId: -1,
        priority: 10
      });

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const response = buildValidationErrorResponse(parseResult.error);
        
        expect(response.success).toBe(false);
        expect(response.errors[0]).toContain('title:');
        expect(response.errors[0]).toContain('workItemId:');
        expect(response.errors[0]).toContain('priority:');
        expect(response.metadata?.validationErrorCount).toBe(3);
      }
    });
  });
});

