import type { QueryCache } from './query-cache.js';
import type { ItemContext } from './query-cache.js';

// Selection criteria interface
export interface SelectionCriteria {
  states?: string[];
  titleContains?: string[];
  tags?: string[];
  daysInactiveMin?: number;
  daysInactiveMax?: number;
}

// Item selection types
export type ItemSelector = 
  | 'all'
  | number[]  // Array of indices
  | SelectionCriteria;

/**
 * Query Executor Service
 * 
 * Handles execution of item selection and retrieval from query handles.
 * Responsibilities:
 * - Select items by indices
 * - Select items by criteria (state, tags, staleness, etc.)
 * - Resolve unified item selectors
 * - Get item context and metadata
 */
export class QueryExecutor {
  constructor(private cache: QueryCache) {}

  /**
   * Selects work items from a query handle using zero-based indices.
   */
  getItemsByIndices(handle: string, indices: number[]): number[] | null {
    const data = this.cache.getQueryData(handle);
    if (!data) return null;

    const validIndices = indices.filter(index => 
      index >= 0 && index < data.workItemIds.length
    );

    return validIndices.map(index => data.workItemIds[index]);
  }

  /**
   * Selects work items from a query handle using criteria-based filtering.
   */
  getItemsByCriteria(handle: string, criteria: SelectionCriteria): number[] | null {
    const data = this.cache.getQueryData(handle);
    if (!data) return null;

    const matchingItems = data.itemContext.filter(item => {
      // State filter
      if (criteria.states && !criteria.states.includes(item.state)) {
        return false;
      }

      // Title contains filter
      if (criteria.titleContains) {
        const titleLower = item.title.toLowerCase();
        const hasMatch = criteria.titleContains.some(term => 
          titleLower.includes(term.toLowerCase())
        );
        if (!hasMatch) return false;
      }

      // Tags filter
      if (criteria.tags && item.tags) {
        const hasMatch = criteria.tags.some(tag => 
          item.tags!.some(itemTag => itemTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      // Days inactive range filter
      if (item.daysInactive !== undefined) {
        if (criteria.daysInactiveMin !== undefined && item.daysInactive < criteria.daysInactiveMin) {
          return false;
        }
        if (criteria.daysInactiveMax !== undefined && item.daysInactive > criteria.daysInactiveMax) {
          return false;
        }
      }

      return true;
    });

    return matchingItems.map(item => item.id);
  }

  /**
   * Get selectable indices for a query handle
   */
  getSelectableIndices(handle: string): number[] | null {
    const data = this.cache.getQueryData(handle);
    return data?.selectionMetadata.selectableIndices || null;
  }

  /**
   * Retrieves detailed context for a work item at a specific index position.
   */
  getItemContext(handle: string, index: number): ItemContext | null {
    const data = this.cache.getQueryData(handle);
    if (!data) return null;

    // Validate index is in range
    if (index < 0 || index >= data.itemContext.length) {
      return null;
    }

    return data.itemContext[index];
  }

  /**
   * Resolves an ItemSelector to work item IDs, supporting multiple selection patterns.
   */
  resolveItemSelector(handle: string, selector: ItemSelector): number[] | null {
    const data = this.cache.getQueryData(handle);
    if (!data) return null;

    if (selector === 'all') {
      return data.workItemIds;
    }

    if (Array.isArray(selector)) {
      return this.getItemsByIndices(handle, selector);
    }

    // Validate selector is an object before treating as criteria
    if (selector && typeof selector === 'object') {
      return this.getItemsByCriteria(handle, selector);
    }

    // Invalid selector type
    return null;
  }
}
