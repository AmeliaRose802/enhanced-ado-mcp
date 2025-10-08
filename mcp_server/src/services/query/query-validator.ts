/**
 * Query Validator Service
 * 
 * Handles validation of query syntax and parameters.
 * Responsibilities:
 * - Validate WIQL query structure
 * - Validate query parameters
 * - Validate item selection criteria
 * - Check handle validity
 */
export class QueryValidator {
  /**
   * Validate basic WIQL query structure
   */
  validateWiqlStructure(query: string): { valid: boolean; error?: string } {
    const upperQuery = query.toUpperCase();

    if (!upperQuery.includes('SELECT')) {
      return { valid: false, error: 'Query must contain SELECT clause' };
    }

    if (!upperQuery.includes('FROM')) {
      return { valid: false, error: 'Query must contain FROM clause' };
    }

    const fromClause = query.match(/FROM\s+(WorkItems|WorkItemLinks)/i);
    if (!fromClause) {
      return { valid: false, error: 'FROM clause must specify WorkItems or WorkItemLinks' };
    }

    // Check for ORDER BY with WorkItemLinks
    if (fromClause[1].toUpperCase() === 'WORKITEMLINKS' && upperQuery.includes('ORDER BY')) {
      return { 
        valid: false, 
        error: 'ORDER BY is not supported with WorkItemLinks queries. Use WorkItems query or remove ORDER BY clause.' 
      };
    }

    return { valid: true };
  }

  /**
   * Validate query handle format
   */
  validateHandleFormat(handle: string): { valid: boolean; error?: string } {
    if (!handle || typeof handle !== 'string') {
      return { valid: false, error: 'Handle must be a non-empty string' };
    }

    if (!handle.startsWith('qh_')) {
      return { valid: false, error: 'Handle must start with "qh_"' };
    }

    if (handle.length !== 35) { // 'qh_' + 32 hex chars
      return { valid: false, error: 'Invalid handle format' };
    }

    const hexPart = handle.substring(3);
    if (!/^[0-9a-f]{32}$/.test(hexPart)) {
      return { valid: false, error: 'Handle must contain valid hexadecimal characters' };
    }

    return { valid: true };
  }

  /**
   * Validate indices array
   */
  validateIndices(indices: number[], maxIndex: number): { valid: boolean; error?: string } {
    if (!Array.isArray(indices)) {
      return { valid: false, error: 'Indices must be an array' };
    }

    if (indices.length === 0) {
      return { valid: false, error: 'Indices array cannot be empty' };
    }

    for (const index of indices) {
      if (!Number.isInteger(index)) {
        return { valid: false, error: 'All indices must be integers' };
      }
      if (index < 0) {
        return { valid: false, error: 'Indices cannot be negative' };
      }
      if (index >= maxIndex) {
        return { valid: false, error: `Index ${index} exceeds maximum index ${maxIndex - 1}` };
      }
    }

    return { valid: true };
  }

  /**
   * Validate selection criteria
   */
  validateSelectionCriteria(criteria: any): { valid: boolean; error?: string } {
    if (typeof criteria !== 'object' || criteria === null) {
      return { valid: false, error: 'Criteria must be an object' };
    }

    // Validate states array if present
    if (criteria.states !== undefined) {
      if (!Array.isArray(criteria.states)) {
        return { valid: false, error: 'states must be an array' };
      }
      if (criteria.states.some((s: any) => typeof s !== 'string')) {
        return { valid: false, error: 'All states must be strings' };
      }
    }

    // Validate titleContains array if present
    if (criteria.titleContains !== undefined) {
      if (!Array.isArray(criteria.titleContains)) {
        return { valid: false, error: 'titleContains must be an array' };
      }
      if (criteria.titleContains.some((t: any) => typeof t !== 'string')) {
        return { valid: false, error: 'All titleContains values must be strings' };
      }
    }

    // Validate tags array if present
    if (criteria.tags !== undefined) {
      if (!Array.isArray(criteria.tags)) {
        return { valid: false, error: 'tags must be an array' };
      }
      if (criteria.tags.some((t: any) => typeof t !== 'string')) {
        return { valid: false, error: 'All tags must be strings' };
      }
    }

    // Validate daysInactiveMin if present
    if (criteria.daysInactiveMin !== undefined) {
      if (typeof criteria.daysInactiveMin !== 'number') {
        return { valid: false, error: 'daysInactiveMin must be a number' };
      }
      if (criteria.daysInactiveMin < 0) {
        return { valid: false, error: 'daysInactiveMin cannot be negative' };
      }
    }

    // Validate daysInactiveMax if present
    if (criteria.daysInactiveMax !== undefined) {
      if (typeof criteria.daysInactiveMax !== 'number') {
        return { valid: false, error: 'daysInactiveMax must be a number' };
      }
      if (criteria.daysInactiveMax < 0) {
        return { valid: false, error: 'daysInactiveMax cannot be negative' };
      }
      if (criteria.daysInactiveMin !== undefined && criteria.daysInactiveMax < criteria.daysInactiveMin) {
        return { valid: false, error: 'daysInactiveMax must be greater than or equal to daysInactiveMin' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate TTL value
   */
  validateTTL(ttlMs: number): { valid: boolean; error?: string } {
    if (typeof ttlMs !== 'number') {
      return { valid: false, error: 'TTL must be a number' };
    }

    if (ttlMs <= 0) {
      return { valid: false, error: 'TTL must be greater than 0' };
    }

    if (ttlMs > 24 * 60 * 60 * 1000) { // 24 hours
      return { valid: false, error: 'TTL cannot exceed 24 hours' };
    }

    return { valid: true };
  }
}
