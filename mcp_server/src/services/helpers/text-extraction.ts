/**
 * Text extraction and parsing utilities
 */

export function extractScore(text: string, metric: string): number {
  const regex = new RegExp(`${metric}[^\\d]*([\\d]+)[/\\s]*10`, 'i');
  const match = text.match(regex);
  return match ? parseInt(match[1]) : 5;
}

export function extractConfidence(text: string): number {
  const match = text.match(/confidence[:\s]*([0-9.]+)/i) || 
                text.match(/([0-9]+)%\s*confident/i);
  if (match) {
    let value = parseFloat(match[1]);
    if (value > 1) value = value / 100;
    return Math.min(1, Math.max(0, value));
  }
  return 0.5;
}

export function extractNumber(text: string, pattern: string): number {
  const regex = new RegExp(`${pattern}[^\\d]*([\\d]+)`, 'i');
  const match = text.match(regex);
  return match ? parseInt(match[1]) : 0;
}

export function extractFileRange(text: string): { min: number; max: number } {
  const match = text.match(/(\d+)[-–]\s*(\d+)\s*files/i) ||
                text.match(/min[:\s]*(\d+)[,\s]*max[:\s]*(\d+)/i);
  return match ? { min: parseInt(match[1]), max: parseInt(match[2]) } : { min: 1, max: 3 };
}

export function extractBulletPoints(text: string, maxItems: number = 10): string[] {
  const matches = text.match(/[-*•]\s*(.+)/g) || text.match(/\d+\.\s*(.+)/g);
  if (!matches) return [];
  
  return matches
    .slice(0, maxItems)
    .map((match: string) => match.replace(/^[-*•\d.\s]+/, '').trim())
    .filter((item: string) => item.length > 10);
}

export function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword.toLowerCase()));
}
