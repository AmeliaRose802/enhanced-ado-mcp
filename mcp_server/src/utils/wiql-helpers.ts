/**
 * WIQL Query Helper Utilities
 * Provides functions for extracting and cleaning WIQL queries from AI responses
 */

/**
 * Extract WIQL query from AI response text
 * Looks for SQL code blocks or plain WIQL queries
 */
export function extractWiqlQuery(text: string): string | null {
  // Try to find SQL code block first
  const sqlBlockMatch = text.match(/```sql\s*([\s\S]+?)\s*```/i);
  if (sqlBlockMatch) {
    return sqlBlockMatch[1].trim();
  }

  // Try generic code block
  const codeBlockMatch = text.match(/```\s*([\s\S]+?)\s*```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // Check if it looks like a WIQL query
    if (content.toUpperCase().includes('SELECT') && content.toUpperCase().includes('FROM')) {
      return content;
    }
  }

  // Try to find SELECT...FROM pattern in plain text
  const selectMatch = text.match(/SELECT[\s\S]+?FROM[\s\S]+?(?:WHERE[\s\S]+?)?(?:ORDER BY[\s\S]+?)?(?=\n\n|\n$|$)/i);
  if (selectMatch) {
    return selectMatch[0].trim();
  }

  return null;
}

/**
 * Clean and normalize WIQL query
 * Removes extra whitespace, normalizes line breaks
 */
export function cleanWiqlQuery(query: string): string {
  return query
    .trim()
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    // Remove multiple spaces
    .replace(/ +/g, ' ')
    // Remove leading/trailing whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}
