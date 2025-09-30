/**
 * Formatting utilities for sampling requests
 */

export function formatForAI(data: Record<string, any>): string {
  return Object.entries(data)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n\n');
}
