/**
 * AI utilities for JSON parsing and formatting
 * Combined utilities for working with AI responses
 */

/**
 * Extract JSON from text that may contain markdown code blocks or other formatting
 */
export function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const codeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1]);
      } catch {}
    }
    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) {
      try {
        return JSON.parse(obj[0]);
      } catch {}
    }
  }
  return null;
}

/**
 * Format data for AI consumption (key: value format)
 */
export function formatForAI(data: Record<string, any>): string {
  return Object.entries(data)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n\n');
}
