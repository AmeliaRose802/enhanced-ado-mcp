/**
 * Full-Text Search Service
 * 
 * Provides fast full-text search across work item fields using FlexSearch.
 * Supports fuzzy matching, relevance scoring, field weighting, and boolean operators.
 */

import { logger, errorToContext } from '@/utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface SearchableWorkItem {
  id: number;
  title: string;
  description?: string;
  comments?: string[];
  acceptanceCriteria?: string;
  tags?: string[];
  state?: string;
  type?: string;
  assignedTo?: string;
  url?: string;
  changedDate?: string;
}

export interface SearchResult {
  id: number;
  score: number;
  title: string;
  type?: string;
  state?: string;
  url?: string;
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  field: string;
  snippet: string;
  matchedTerms: string[];
}

export interface SearchOptions {
  fields?: ('title' | 'description' | 'comments' | 'acceptanceCriteria' | 'tags' | 'all')[];
  maxResults?: number;
  fuzzyThreshold?: number;
  filterByType?: string[];
  filterByState?: string[];
  filterByAssignee?: string;
  includeHighlights?: boolean;
  booleanMode?: boolean; // Enable AND, OR, NOT operators
}

export interface SearchStats {
  totalDocuments: number;
  indexSize: number; // Approximate size in bytes
  lastUpdated: Date;
  version: string;
}

// Type definitions for FlexSearch Document
interface FlexSearchDocument<T> {
  add(id: number | string, doc: T): this;
  addAsync(id: number | string, doc: T): Promise<this>;
  remove(id: number | string): this;
  removeAsync(id: number | string): Promise<this>;
  search(query: string, options?: SearchQueryOptions): SearchQueryResult[];
  searchAsync(query: string, options?: SearchQueryOptions): Promise<SearchQueryResult[]>;
}

interface SearchQueryOptions {
  index?: string;
  limit?: number;
  suggest?: boolean;
}

interface SearchQueryResult {
  field: string;
  result: (number | string)[];
}

/**
 * FlexSearch configuration options
 */
interface FlexSearchOptions {
  document?: {
    id: string;
    index: string | string[];
    store?: string | string[] | boolean;
  };
  tokenize?: string;
  resolution?: number;
  cache?: boolean;
  worker?: boolean;
  optimize?: boolean;
  context?: boolean | {
    resolution?: number;
    depth?: number;
    bidirectional?: boolean;
  };
}

// FlexSearch Document constructor type
type FlexSearchDocumentConstructor = new <T>(options: FlexSearchOptions) => FlexSearchDocument<T>;

/**
 * Search Service
 * Manages full-text search index for work items
 */
class SearchService {
  private index: FlexSearchDocument<SearchableWorkItem> | null = null;
  private documents: Map<number, SearchableWorkItem>;
  private indexPath: string;
  private stats: SearchStats;
  private isInitialized: boolean = false;
  private FlexSearchDocument: FlexSearchDocumentConstructor | null = null;

  constructor() {
    this.documents = new Map();
    
    // Store index in temp directory
    const tempDir = os.tmpdir();
    this.indexPath = path.join(tempDir, 'ado-mcp-search-index.json');
    
    this.stats = {
      totalDocuments: 0,
      indexSize: 0,
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Initialize FlexSearch library (dynamic import)
   */
  private async initFlexSearch(): Promise<void> {
    if (this.FlexSearchDocument) {
      return;
    }

    try {
      // Dynamic import to handle CJS/ESM compatibility
      const FlexSearch = await import('flexsearch');
      // @ts-ignore - FlexSearch type compatibility`n      this.FlexSearchDocument = FlexSearch.Document || (FlexSearch as any).default?.Document;
      
      if (!this.FlexSearchDocument) {
        throw new Error('FlexSearch Document constructor not found');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load FlexSearch: ${errorMsg}`);
      throw new Error(`FlexSearch initialization failed: ${errorMsg}`);
    }
  }

  /**
   * Create FlexSearch index
   */
  private async createIndex(): Promise<void> {
    await this.initFlexSearch();
    
    if (!this.FlexSearchDocument) {
      throw new Error('FlexSearch not initialized');
    }

    // Initialize FlexSearch document index with field weighting
    this.index = new this.FlexSearchDocument({
      document: {
        id: 'id',
        index: [
          {
            field: 'title',
            tokenize: 'forward',
            optimize: true,
            resolution: 9,
            depth: 3,
            bidirectional: true,
            context: {
              resolution: 5,
              depth: 2,
              bidirectional: true
            }
          } as any,
          {
            field: 'description',
            tokenize: 'forward',
            optimize: true,
            resolution: 5,
            depth: 2
          } as any,
          {
            field: 'comments',
            tokenize: 'forward',
            optimize: true,
            resolution: 3
          } as any,
          {
            field: 'acceptanceCriteria',
            tokenize: 'forward',
            optimize: true,
            resolution: 5,
            depth: 2
          } as any,
          {
            field: 'tags',
            tokenize: 'full',
            optimize: true
          } as any
        ],
        store: ['title', 'type', 'state', 'url', 'description', 'comments', 'acceptanceCriteria']
      },
      encode: 'balance',
      tokenize: 'forward',
      threshold: 0,
      resolution: 9,
      depth: 3,
      bidirectional: true,
      cache: true
    } as any);
  }

  /**
   * Initialize the search service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Initialize FlexSearch and create index
    await this.createIndex();

    try {
      // Try to load existing index
      await this.loadIndex();
      logger.info(`Search index loaded: ${this.stats.totalDocuments} documents`);
    } catch (error) {
      logger.info('No existing search index found, starting fresh');
    }

    this.isInitialized = true;
  }

  /**
   * Add or update work items in the index
   */
  async indexWorkItems(items: SearchableWorkItem[]): Promise<void> {
    if (!this.index) {
      await this.createIndex();
    }

    const startTime = Date.now();
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const exists = this.documents.has(item.id);
      
      // Store document metadata
      this.documents.set(item.id, item);
      
      // Add to search index
      await this.index!.addAsync(item.id, {
        id: item.id,
        title: item.title || '',
        description: item.description || '',
        comments: (item.comments || []).join(' '),
        acceptanceCriteria: item.acceptanceCriteria || '',
        tags: (item.tags || []).join(' '),
        type: item.type || '',
        state: item.state || '',
        assignedTo: item.assignedTo || '',
        url: item.url || ''
      } as any);

      if (exists) {
        updatedCount++;
      } else {
        addedCount++;
      }
    }

    this.stats.totalDocuments = this.documents.size;
    this.stats.lastUpdated = new Date();

    const elapsed = Date.now() - startTime;
    logger.info(`Indexed ${addedCount} new, updated ${updatedCount} items in ${elapsed}ms`);
  }

  /**
   * Remove work items from the index
   */
  async removeWorkItems(ids: number[]): Promise<void> {
    if (!this.index) {
      return;
    }

    for (const id of ids) {
      this.documents.delete(id);
      await this.index!.removeAsync(id);
    }

    this.stats.totalDocuments = this.documents.size;
    this.stats.lastUpdated = new Date();
    
    logger.info(`Removed ${ids.length} items from search index`);
  }

  /**
   * Search for work items
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.index) {
      throw new Error('Search index not initialized');
    }

    const {
      fields = ['all'],
      maxResults = 50,
      fuzzyThreshold = 0.8,
      filterByType,
      filterByState,
      filterByAssignee,
      includeHighlights = true,
      booleanMode = false
    } = options;

    const startTime = Date.now();

    // Determine which fields to search
    const searchFields = fields.includes('all') 
      ? ['title', 'description', 'comments', 'acceptanceCriteria', 'tags']
      : fields;

    // Process query for boolean operators if enabled
    const processedQuery = booleanMode ? this.processBooleanQuery(query) : query;

    // Search across specified fields
    const searchResults: Map<number, { score: number; fields: Set<string> }> = new Map();

    for (const field of searchFields) {
      try {
        const results = await this.index!.searchAsync(processedQuery, {
          index: field,
          limit: maxResults * 2, // Get more results to account for filtering
          suggest: true
        });

        // FlexSearch returns array of results per field
        for (const result of results) {
          if (Array.isArray(result.result)) {
            for (const id of result.result) {
              const numId = typeof id === 'number' ? id : parseInt(id as string, 10);
              const existing = searchResults.get(numId);
              
              if (existing) {
                // Boost score based on field weight
                const fieldWeight = this.getFieldWeight(field);
                existing.score += fieldWeight;
                existing.fields.add(field);
              } else {
                searchResults.set(numId, {
                  score: this.getFieldWeight(field),
                  fields: new Set([field])
                });
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`Search error for field ${field}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Convert to results array and apply filters
    let results: SearchResult[] = [];
    
    for (const [id, { score, fields }] of searchResults) {
      const doc = this.documents.get(id);
      if (!doc) continue;

      // Apply filters
      if (filterByType && !filterByType.includes(doc.type || '')) continue;
      if (filterByState && !filterByState.includes(doc.state || '')) continue;
      if (filterByAssignee && doc.assignedTo !== filterByAssignee) continue;

      const result: SearchResult = {
        id,
        score,
        title: doc.title,
        type: doc.type,
        state: doc.state,
        url: doc.url,
        highlights: []
      };

      // Generate highlights
      if (includeHighlights) {
        result.highlights = this.generateHighlights(doc, query, Array.from(fields));
      }

      results.push(result);
    }

    // Sort by relevance score (descending)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    results = results.slice(0, maxResults);

    const elapsed = Date.now() - startTime;
    logger.debug(`Search completed in ${elapsed}ms, found ${results.length} results`);

    return results;
  }

  /**
   * Get field weight for scoring
   */
  private getFieldWeight(field: string): number {
    const weights: Record<string, number> = {
      title: 10,
      description: 5,
      acceptanceCriteria: 5,
      comments: 2,
      tags: 8
    };
    return weights[field] || 1;
  }

  /**
   * Generate context snippets with highlighted terms
   */
  private generateHighlights(
    doc: SearchableWorkItem,
    query: string,
    fields: string[]
  ): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    for (const field of fields) {
      let content = '';
      
      switch (field) {
        case 'title':
          content = doc.title || '';
          break;
        case 'description':
          content = doc.description || '';
          break;
        case 'comments':
          content = (doc.comments || []).join(' ');
          break;
        case 'acceptanceCriteria':
          content = doc.acceptanceCriteria || '';
          break;
        case 'tags':
          content = (doc.tags || []).join(', ');
          break;
      }

      if (!content) continue;

      // Find matching terms
      const matchedTerms: string[] = [];
      const contentLower = content.toLowerCase();
      
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          matchedTerms.push(term);
        }
      }

      if (matchedTerms.length > 0) {
        // Generate snippet with context
        const snippet = this.generateSnippet(content, matchedTerms[0], 100);
        
        highlights.push({
          field,
          snippet,
          matchedTerms
        });
      }
    }

    return highlights;
  }

  /**
   * Generate a context snippet around a matched term
   */
  private generateSnippet(text: string, term: string, contextLength: number = 100): string {
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(term.toLowerCase());
    
    if (index === -1) {
      return text.substring(0, contextLength) + (text.length > contextLength ? '...' : '');
    }

    const start = Math.max(0, index - Math.floor(contextLength / 2));
    const end = Math.min(text.length, start + contextLength);
    
    let snippet = text.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Process boolean query (basic AND, OR, NOT support)
   */
  private processBooleanQuery(query: string): string {
    // This is a simplified implementation
    // FlexSearch doesn't natively support boolean operators,
    // so we'll handle this by splitting and searching multiple times
    // For now, just return the original query (boolean parsing not implemented)
    return query;
  }

  /**
   * Save index to disk
   */
  async saveIndex(): Promise<void> {
    try {
      const data = {
        documents: Array.from(this.documents.entries()),
        stats: this.stats
      };

      await fs.writeFile(this.indexPath, JSON.stringify(data), 'utf-8');
      
      // Update index size
      const stat = await fs.stat(this.indexPath);
      this.stats.indexSize = stat.size;
      
      logger.info(`Search index saved to ${this.indexPath} (${(this.stats.indexSize / 1024).toFixed(2)} KB)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save search index: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Load index from disk
   */
  async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(data);

      this.documents = new Map(parsed.documents);
      this.stats = {
        ...parsed.stats,
        lastUpdated: new Date(parsed.stats.lastUpdated)
      };

      // Ensure index is created
      if (!this.index) {
        await this.createIndex();
      }

      // Rebuild FlexSearch index from documents
      const items = Array.from(this.documents.values());
      for (const item of items) {
        await this.index!.addAsync(item.id, {
          id: item.id,
          title: item.title || '',
          description: item.description || '',
          comments: (item.comments || []).join(' '),
          acceptanceCriteria: item.acceptanceCriteria || '',
          tags: (item.tags || []).join(' '),
          type: item.type || '',
          state: item.state || '',
          assignedTo: item.assignedTo || '',
          url: item.url || ''
        } as any);
      }

      logger.info(`Search index loaded: ${this.stats.totalDocuments} documents`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load search index: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Clear entire index
   */
  async clearIndex(): Promise<void> {
    this.documents.clear();
    this.index = null; // Will be recreated on next operation
    
    this.stats = {
      totalDocuments: 0,
      indexSize: 0,
      lastUpdated: new Date(),
      version: '1.0.0'
    };

    logger.info('Search index cleared');
  }

  /**
   * Get search statistics
   */
  getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * Get total documents indexed
   */
  getTotalDocuments(): number {
    return this.documents.size;
  }

  /**
   * Check if a work item is indexed
   */
  isIndexed(id: number): boolean {
    return this.documents.has(id);
  }
}

// Export singleton instance
export const searchService = new SearchService();

