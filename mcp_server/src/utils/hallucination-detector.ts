/**
 * Hallucination Detection Utility
 * 
 * Detects when agents attempt to use hallucinated work item IDs by analyzing patterns
 * that indicate the agent is guessing or fabricating IDs rather than using real data.
 */

import { logger } from './logger.js';

export interface HallucinationDetectionResult {
  isLikelyHallucinated: boolean;
  confidence: number; // 0-1 scale
  reasons: string[];
  suggestion?: string;
}

/**
 * Detect if a list of work item IDs appears to be hallucinated
 * 
 * Common hallucination patterns:
 * - Sequential IDs (e.g., [1,2,3,4,5])
 * - Round numbers (e.g., [100,200,300])
 * - Very low IDs (e.g., [1,2,3]) in established projects
 * - Suspiciously perfect patterns
 * 
 * @param ids Array of work item IDs to analyze
 * @param context Optional context about the request
 * @returns Detection result with confidence score
 */
export function detectHallucinatedIds(
  ids: number[],
  context?: {
    projectAge?: 'new' | 'established'; // New projects might legitimately have low IDs
    expectedRange?: { min: number; max: number }; // Known valid ID range
    recentIds?: number[]; // Recently seen real IDs for comparison
  }
): HallucinationDetectionResult {
  const reasons: string[] = [];
  let suspicionScore = 0;

  if (ids.length === 0) {
    return {
      isLikelyHallucinated: false,
      confidence: 0,
      reasons: ['No IDs provided']
    };
  }

  // Pattern 1: Sequential IDs (e.g., 1,2,3,4,5)
  const isSequential = ids.length >= 3 && ids.every((id, i) => i === 0 || id === ids[i - 1] + 1);
  if (isSequential) {
    suspicionScore += 0.7;
    reasons.push('IDs are perfectly sequential (very unlikely in real work items)');
  }

  // Pattern 2: All round numbers (multiples of 10, 100, etc.)
  const roundNumbers = ids.filter(id => id % 10 === 0);
  if (roundNumbers.length === ids.length && ids.length >= 3) {
    suspicionScore += 0.5;
    reasons.push('All IDs are round numbers (suspicious pattern)');
  }

  // Pattern 3: Very low IDs in established projects
  const veryLowIds = ids.filter(id => id <= 10);
  if (veryLowIds.length > 0 && context?.projectAge === 'established') {
    suspicionScore += 0.6;
    reasons.push('Contains very low IDs (<= 10) in an established project');
  }

  // Pattern 4: IDs outside expected range
  if (context?.expectedRange) {
    const { min, max } = context.expectedRange;
    const outOfRange = ids.filter(id => id < min || id > max);
    if (outOfRange.length > 0) {
      suspicionScore += 0.8;
      reasons.push(`${outOfRange.length} IDs outside expected range (${min}-${max})`);
    }
  }

  // Pattern 5: IDs don't match recent real IDs pattern
  if (context?.recentIds && context.recentIds.length > 0) {
    const recentMin = Math.min(...context.recentIds);
    const recentMax = Math.max(...context.recentIds);
    const providedMin = Math.min(...ids);
    const providedMax = Math.max(...ids);
    
    // If provided IDs are way below recent IDs, that's suspicious
    if (providedMax < recentMin - 1000) {
      suspicionScore += 0.7;
      reasons.push(`Provided IDs (max: ${providedMax}) are far below recently seen IDs (min: ${recentMin})`);
    }
  }

  // Pattern 6: Suspiciously small ID set with perfect patterns
  if (ids.length <= 5 && ids.every(id => id <= 100)) {
    suspicionScore += 0.4;
    reasons.push('Small set of low IDs (common hallucination pattern)');
  }

  // Cap confidence at 1.0
  const confidence = Math.min(suspicionScore, 1.0);
  const isLikelyHallucinated = confidence >= 0.6;

  let suggestion: string | undefined;
  if (isLikelyHallucinated) {
    suggestion = 'Use wit-wiql-query with returnQueryHandle=true, then pass the query handle to bulk operations instead of manual IDs.';
  }

  if (isLikelyHallucinated) {
    logger.warn(`🚨 Hallucination detected! Confidence: ${(confidence * 100).toFixed(0)}%. Reasons: ${reasons.join('; ')}`);
  }

  return {
    isLikelyHallucinated,
    confidence,
    reasons,
    suggestion
  };
}

/**
 * Detect if a single ID appears suspicious
 */
export function detectSuspiciousId(id: number, context?: { projectAge?: 'new' | 'established' }): boolean {
  const result = detectHallucinatedIds([id], context);
  return result.isLikelyHallucinated;
}

/**
 * Check if work item IDs follow a pattern consistent with real Azure DevOps IDs
 */
export function validateIdPattern(ids: number[]): { valid: boolean; message: string } {
  if (ids.length === 0) {
    return { valid: false, message: 'No IDs provided' };
  }

  // Real ADO IDs are positive integers
  const invalidIds = ids.filter(id => !Number.isInteger(id) || id <= 0);
  if (invalidIds.length > 0) {
    return { valid: false, message: `Invalid IDs: ${invalidIds.join(', ')} (must be positive integers)` };
  }

  // Check for obvious hallucination patterns
  const detection = detectHallucinatedIds(ids);
  if (detection.isLikelyHallucinated) {
    return {
      valid: false,
      message: `IDs appear to be hallucinated. ${detection.reasons.join('. ')}. ${detection.suggestion}`
    };
  }

  return { valid: true, message: 'IDs appear valid' };
}
