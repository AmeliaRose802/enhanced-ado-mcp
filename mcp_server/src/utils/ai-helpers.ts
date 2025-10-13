/**
 * AI utilities for JSON parsing and formatting
 * Combined utilities for working with AI responses
 */

/**
 * Extract JSON from text that may contain markdown code blocks or other formatting
 */
export function extractJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const codeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1]) as Record<string, unknown>;
      } catch {}
    }
    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) {
      try {
        return JSON.parse(obj[0]) as Record<string, unknown>;
      } catch {}
    }
  }
  return null;
}

/**
 * Format data for AI consumption (key: value format)
 */
export function formatForAI(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n\n');
}

/**
 * Type-safe helper functions for parsing AI JSON responses
 */

export function getStringOrDefault(value: unknown, defaultValue: string): string {
  return typeof value === 'string' ? value : defaultValue;
}

export function getNumberOrDefault(value: unknown, defaultValue: number): number {
  return typeof value === 'number' ? value : defaultValue;
}

export function getBooleanOrDefault(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

export function getArrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

export function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}
