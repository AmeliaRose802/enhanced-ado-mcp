/**
 * JSON parsing utilities for AI responses
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
