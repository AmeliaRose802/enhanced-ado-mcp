import { marked } from 'marked';
import { logger } from './logger.js';

/**
 * Convert markdown content to HTML for Azure DevOps HTML fields
 * 
 * Azure DevOps HTML fields (System.Description, Microsoft.VSTS.Common.AcceptanceCriteria, etc.)
 * require HTML content, not plain text or markdown. This utility converts markdown to HTML
 * with ADO-compatible formatting.
 * 
 * @param markdown - Markdown content to convert
 * @returns HTML string suitable for Azure DevOps HTML fields
 * 
 * @example
 * ```typescript
 * const html = convertMarkdownToHtml('# Title\n\nSome **bold** text');
 * // Returns: '<h1>Title</h1>\n<p>Some <strong>bold</strong> text</p>'
 * ```
 */
export function convertMarkdownToHtml(markdown: string | undefined | null): string {
  if (!markdown) return '';
  
  // Configure marked for ADO-compatible HTML
  marked.setOptions({
    gfm: true,        // GitHub Flavored Markdown
    breaks: true,     // Convert \n to <br>
    pedantic: false,  // Don't be strict about Markdown syntax
    silent: true      // Don't throw on parsing errors
  });
  
  try {
    // Convert markdown to HTML
    const html = marked.parse(markdown) as string;
    return html.trim();
  } catch (error) {
    // If parsing fails, return the original text wrapped in a paragraph
    logger.error('Failed to parse markdown:', error);
    return `<p>${escapeHtml(markdown)}</p>`;
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Check if content appears to be markdown (vs plain text or HTML)
 * 
 * This is a heuristic check to avoid double-converting HTML content.
 * Returns true if content contains markdown syntax.
 */
export function isMarkdown(content: string | undefined | null): boolean {
  if (!content) return false;
  
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers: # Header
    /\*\*[^*]+\*\*/,        // Bold: **text**
    /__[^_]+__/,            // Bold: __text__
    /\*[^*]+\*/,            // Italic: *text*
    /_[^_]+_/,              // Italic: _text_
    /^\s*[-*+]\s/m,         // Unordered lists: - item
    /^\s*\d+\.\s/m,         // Ordered lists: 1. item
    /\[.+\]\(.+\)/,         // Links: [text](url)
    /`[^`]+`/,              // Inline code: `code`
    /^```/m,                // Code blocks: ```
    /^\s*>\s/m,             // Blockquotes: > quote
    /^\s*\|.+\|/m,          // Tables: | col1 | col2 |
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
}

/**
 * Smart conversion: Only convert if content appears to be markdown
 * 
 * If content already looks like HTML, return it as-is.
 * If content looks like markdown, convert it to HTML.
 * If content is plain text, wrap it in a paragraph tag.
 * 
 * @param content - Content to process
 * @returns HTML string
 */
export function smartConvertToHtml(content: string | undefined | null): string {
  if (!content) return '';
  
  // If it already looks like HTML (starts with <), return as-is
  if (content.trim().startsWith('<')) {
    return content;
  }
  
  // If it looks like markdown, convert it
  if (isMarkdown(content)) {
    return convertMarkdownToHtml(content);
  }
  
  // Otherwise, wrap plain text in paragraph tags
  return `<p>${escapeHtml(content)}</p>`;
}
