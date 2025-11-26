/**
 * Work Item Similarity Service
 * 
 * Provides AI-powered similarity detection using embeddings to find:
 * - Duplicate work items (>90% similarity)
 * - Related work items (60-90% similarity)
 * - Topic clustering
 * - Suggested links between items
 * 
 * Uses VS Code sampling API to generate embeddings and efficient
 * cosine similarity for comparison. Embeddings are cached persistently
 * to avoid regeneration.
 */

import type { ToolExecutionResult } from '../types/index.js';
import type { MCPServer, MCPServerLike } from '../types/mcp.js';
import { logger, errorToContext } from '../utils/logger.js';
import { SamplingClient } from '../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../utils/response-builder.js';
import { loadConfiguration } from '../config/config.js';
import { queryHandleService } from './query-handle-service.js';
import { ADOHttpClient } from '../utils/ado-http-client.js';
import { getTokenProvider } from '../utils/token-provider.js';
import type { ADOWorkItem, ADOApiResponse } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SimilarityDetectionArgs {
  workItemId?: number;
  queryHandle?: string;
  similarityThreshold?: number;
  maxResults?: number;
  includeEmbeddings?: boolean;
  skipCache?: boolean;
  organization?: string;
  project?: string;
  analysisType?: 'duplicates' | 'related' | 'cluster' | 'all';
}

export interface WorkItemEmbedding {
  workItemId: number;
  title: string;
  type: string;
  state: string;
  embedding: number[];
  text: string;
  generatedAt: string;
}

export interface SimilarWorkItem {
  workItemId: number;
  title: string;
  type: string;
  state: string;
  similarityScore: number;
  reasons: string[];
  suggestedLinkType?: 'Related' | 'Duplicate' | 'Parent' | 'Child' | 'Depends On';
  confidence: number;
}

export interface SimilarityAnalysisResult {
  sourceWorkItem: {
    id: number;
    title: string;
    type: string;
  };
  similarItems: SimilarWorkItem[];
  clusters?: Array<{
    topicName: string;
    workItemIds: number[];
    avgSimilarity: number;
  }>;
  duplicateCandidates?: SimilarWorkItem[];
  relatedCandidates?: SimilarWorkItem[];
  analysisMetadata: {
    totalCompared: number;
    cacheHitRate: number;
    embeddingsGenerated: number;
    analysisType: string;
  };
}

export class SimilarityService {
  private samplingClient: SamplingClient;
  private embeddingCache: Map<number, WorkItemEmbedding>;
  private cacheFilePath: string;
  private readonly EMBEDDING_DIMENSION = 1536; // Typical embedding dimension
  private readonly CACHE_VERSION = 1;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
    this.embeddingCache = new Map();
    
    // Set cache file path in user's temp directory
    const tempDir = os.tmpdir();
    const cacheDir = path.join(tempDir, 'enhanced-ado-mcp', 'embeddings');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cacheFilePath = path.join(cacheDir, 'work-item-embeddings.json');
    
    this.loadEmbeddingCache();
  }

  async findSimilar(args: SimilarityDetectionArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting similarity detection with threshold: ${args.similarityThreshold || 0.6}`);

    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const config = loadConfiguration();
      const org = args.organization || config.azureDevOps.organization;
      const proj = args.project || config.azureDevOps.project;

      // Determine source work items
      let sourceWorkItemIds: number[] = [];
      if (args.workItemId) {
        sourceWorkItemIds = [args.workItemId];
      } else if (args.queryHandle) {
        const queryData = queryHandleService.getQueryData(args.queryHandle);
        if (!queryData) {
          return buildErrorResponse(
            `Query handle '${args.queryHandle}' not found or expired`,
            { source: 'similarity-service' }
          );
        }
        sourceWorkItemIds = queryData.workItemIds;
      } else {
        return buildErrorResponse(
          'Either workItemId or queryHandle must be provided',
          { source: 'similarity-service' }
        );
      }

      if (sourceWorkItemIds.length === 0) {
        return buildErrorResponse(
          'No work items found to analyze',
          { source: 'similarity-service' }
        );
      }

      logger.info(`Analyzing similarity for ${sourceWorkItemIds.length} work item(s)`);

      // Fetch work items
      const workItems = await this.fetchWorkItems(sourceWorkItemIds, org, proj);
      if (workItems.length === 0) {
        return buildErrorResponse(
          'Failed to fetch work items',
          { source: 'similarity-service' }
        );
      }

      // Get embeddings for source work items
      const sourceEmbeddings = await this.getEmbeddings(
        workItems,
        args.skipCache || false
      );

      // Get candidate work items for comparison (from same area path)
      const candidateItems = await this.fetchCandidateWorkItems(
        workItems[0].fields?.['System.AreaPath'] as string,
        sourceWorkItemIds,
        org,
        proj
      );

      // Get embeddings for candidates
      const candidateEmbeddings = await this.getEmbeddings(
        candidateItems,
        args.skipCache || false
      );

      // Calculate similarities
      const threshold = args.similarityThreshold || 0.6;
      const maxResults = args.maxResults || 20;
      const analysisType = args.analysisType || 'all';

      const results: SimilarityAnalysisResult[] = [];

      for (const sourceEmb of sourceEmbeddings) {
        const similarities: SimilarWorkItem[] = [];

        for (const candidateEmb of candidateEmbeddings) {
          if (sourceEmb.workItemId === candidateEmb.workItemId) {
            continue; // Skip self
          }

          const similarity = this.cosineSimilarity(
            sourceEmb.embedding,
            candidateEmb.embedding
          );

          if (similarity >= threshold) {
            const reasons = await this.analyzeSimilarityReasons(
              sourceEmb,
              candidateEmb,
              similarity
            );

            similarities.push({
              workItemId: candidateEmb.workItemId,
              title: candidateEmb.title,
              type: candidateEmb.type,
              state: candidateEmb.state,
              similarityScore: similarity,
              reasons,
              suggestedLinkType: this.suggestLinkType(similarity, sourceEmb, candidateEmb),
              confidence: this.calculateConfidence(similarity, reasons.length)
            });
          }
        }

        // Sort by similarity score
        similarities.sort((a, b) => b.similarityScore - a.similarityScore);
        
        // Limit results
        const limitedSimilarities = similarities.slice(0, maxResults);

        // Categorize by analysis type
        const duplicates = limitedSimilarities.filter(s => s.similarityScore >= 0.9);
        const related = limitedSimilarities.filter(s => s.similarityScore >= 0.6 && s.similarityScore < 0.9);

        // Build result
        const result: SimilarityAnalysisResult = {
          sourceWorkItem: {
            id: sourceEmb.workItemId,
            title: sourceEmb.title,
            type: sourceEmb.type
          },
          similarItems: limitedSimilarities,
          analysisMetadata: {
            totalCompared: candidateEmbeddings.length,
            cacheHitRate: this.calculateCacheHitRate(),
            embeddingsGenerated: this.getEmbeddingsGenerated(),
            analysisType
          }
        };

        if (analysisType === 'duplicates' || analysisType === 'all') {
          result.duplicateCandidates = duplicates;
        }

        if (analysisType === 'related' || analysisType === 'all') {
          result.relatedCandidates = related;
        }

        if (analysisType === 'cluster' || analysisType === 'all') {
          result.clusters = await this.clusterSimilarItems(
            sourceEmbeddings,
            candidateEmbeddings
          );
        }

        results.push(result);
      }

      // Save embedding cache
      this.saveEmbeddingCache();

      // Return single result if analyzing one item, array if multiple
      const responseData = results.length === 1 ? results[0] : results;

      return buildSuccessResponse(responseData, {
        source: 'similarity-service',
        itemsAnalyzed: sourceWorkItemIds.length,
        threshold: threshold,
        maxResults: maxResults
      });

    } catch (error) {
      logger.error(`Similarity detection failed: ${error}`);
      return buildErrorResponse(
        `Similarity detection failed: ${error instanceof Error ? error.message : String(error)}`,
        { source: 'similarity-service' }
      );
    }
  }

  private async fetchWorkItems(
    workItemIds: number[],
    organization: string,
    project: string
  ): Promise<ADOWorkItem[]> {
    const httpClient = new ADOHttpClient(organization, getTokenProvider(), project);
    
    const fields = [
      'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
      'System.Description', 'System.Tags', 'System.AreaPath',
      'Microsoft.VSTS.Common.AcceptanceCriteria'
    ];

    const workItems: ADOWorkItem[] = [];
    const batchSize = 50;

    for (let i = 0; i < workItemIds.length; i += batchSize) {
      const batch = workItemIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      try {
        const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
          `wit/workitems?ids=${idsParam}&fields=${fields.join(',')}`
        );

        if (response.data?.value) {
          workItems.push(...response.data.value);
        }
      } catch (error) {
        logger.error(`Failed to fetch work items: ${error}`);
        throw error;
      }
    }

    return workItems;
  }

  private async fetchCandidateWorkItems(
    areaPath: string,
    excludeIds: number[],
    organization: string,
    project: string
  ): Promise<ADOWorkItem[]> {
    const httpClient = new ADOHttpClient(organization, getTokenProvider(), project);
    
    // WIQL query to get items from same area path
    const wiql = `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.AreaPath] UNDER '${areaPath}'
      AND [System.Id] NOT IN (${excludeIds.join(',')})
      ORDER BY [System.ChangedDate] DESC
    `;

    try {
      const queryResponse = await httpClient.post<ADOApiResponse<{ workItems: Array<{ id: number }> }>>(
        'wit/wiql',
        { query: wiql }
      );

      const candidateIds = (queryResponse.data as any)?.workItems?.map((wi: any) => wi.id) || [];
      
      // Limit to 200 candidates for performance
      const limitedIds = candidateIds.slice(0, 200);

      if (limitedIds.length === 0) {
        return [];
      }

      return await this.fetchWorkItems(limitedIds, organization, project);
    } catch (error) {
      logger.error(`Failed to fetch candidate work items: ${error}`);
      return [];
    }
  }

  private async getEmbeddings(
    workItems: ADOWorkItem[],
    skipCache: boolean
  ): Promise<WorkItemEmbedding[]> {
    const embeddings: WorkItemEmbedding[] = [];
    const itemsToEmbed: ADOWorkItem[] = [];

    // Check cache first
    for (const item of workItems) {
      const itemId = item.id || 0;
      
      if (!skipCache && this.embeddingCache.has(itemId)) {
        embeddings.push(this.embeddingCache.get(itemId)!);
      } else {
        itemsToEmbed.push(item);
      }
    }

    if (itemsToEmbed.length > 0) {
      logger.info(`Generating embeddings for ${itemsToEmbed.length} work items`);
      
      // Generate embeddings in batches
      const batchSize = 10;
      for (let i = 0; i < itemsToEmbed.length; i += batchSize) {
        const batch = itemsToEmbed.slice(i, i + batchSize);
        const batchEmbeddings = await this.generateEmbeddingsBatch(batch);
        
        // Cache new embeddings
        for (const emb of batchEmbeddings) {
          this.embeddingCache.set(emb.workItemId, emb);
        }
        
        embeddings.push(...batchEmbeddings);
      }
    }

    return embeddings;
  }

  private async generateEmbeddingsBatch(
    workItems: ADOWorkItem[]
  ): Promise<WorkItemEmbedding[]> {
    const embeddings: WorkItemEmbedding[] = [];

    for (const item of workItems) {
      try {
        const embedding = await this.generateEmbedding(item);
        embeddings.push(embedding);
      } catch (error) {
        logger.error(`Failed to generate embedding for work item ${item.id}: ${error}`);
      }
    }

    return embeddings;
  }

  private async generateEmbedding(workItem: ADOWorkItem): Promise<WorkItemEmbedding> {
    const itemId = workItem.id || 0;
    const title = workItem.fields?.['System.Title'] as string || '';
    const description = workItem.fields?.['System.Description'] as string || '';
    const acceptanceCriteria = workItem.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string || '';
    const type = workItem.fields?.['System.WorkItemType'] as string || '';
    const state = workItem.fields?.['System.State'] as string || '';

    // Combine text for embedding
    const text = this.prepareTextForEmbedding(title, description, acceptanceCriteria);

    // Generate embedding using AI
    const embeddingVector = await this.generateEmbeddingVector(text);

    return {
      workItemId: itemId,
      title,
      type,
      state,
      embedding: embeddingVector,
      text,
      generatedAt: new Date().toISOString()
    };
  }

  private prepareTextForEmbedding(
    title: string,
    description: string,
    acceptanceCriteria: string
  ): string {
    // Clean HTML tags from description
    const cleanDesc = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanAC = acceptanceCriteria.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Weight title more heavily (repeat 3x)
    const weightedTitle = `${title} ${title} ${title}`;

    // Combine with separators
    const parts = [weightedTitle, cleanDesc, cleanAC].filter(p => p.length > 0);
    return parts.join(' | ');
  }

  private async generateEmbeddingVector(text: string): Promise<number[]> {
    // Use AI to generate embedding-like representation
    // Since we can't get actual embeddings directly, we'll use a semantic analysis
    // and convert to a pseudo-embedding vector
    
    const userContent = `Generate a semantic representation of this work item text. Extract key concepts, technical terms, domain entities, and themes. Return ONLY a JSON object with:
{
  "concepts": ["concept1", "concept2", ...],
  "technicalTerms": ["term1", "term2", ...],
  "domains": ["domain1", "domain2", ...],
  "themes": ["theme1", "theme2", ...],
  "sentiment": "positive|neutral|negative",
  "complexity": "low|medium|high"
}

Text to analyze:
${text.substring(0, 2000)}`;

    const aiResult = await this.samplingClient.createMessage({
      systemPromptName: 'embedding-generator',
      userContent,
      maxTokens: 500,
      temperature: 0.1
    });

    const responseText = this.samplingClient.extractResponseText(aiResult);
    
    // Parse semantic features
    const semanticFeatures = this.parseSemanticFeatures(responseText);
    
    // Convert to pseudo-embedding vector
    return this.convertToEmbeddingVector(semanticFeatures, text);
  }

  private parseSemanticFeatures(aiResponse: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.debug(`Failed to parse semantic features: ${error}`);
    }

    // Return default features
    return {
      concepts: [],
      technicalTerms: [],
      domains: [],
      themes: [],
      sentiment: 'neutral',
      complexity: 'medium'
    };
  }

  private convertToEmbeddingVector(semanticFeatures: any, originalText: string): number[] {
    // Create a pseudo-embedding vector based on semantic features
    // This is a simplified representation but provides similarity comparison capability
    
    const vector: number[] = [];
    
    // Hash function for converting strings to numbers
    const hashString = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash) / 2147483647; // Normalize to 0-1
    };

    // Feature dimensions (total 128 dimensions for efficiency)
    const dimensions = {
      concepts: 40,
      technicalTerms: 30,
      domains: 20,
      themes: 20,
      metadata: 18
    };

    // Concepts dimension
    for (let i = 0; i < dimensions.concepts; i++) {
      const conceptIndex = i % (semanticFeatures.concepts?.length || 1);
      const concept = semanticFeatures.concepts?.[conceptIndex] || '';
      vector.push(concept ? hashString(concept + i) : 0);
    }

    // Technical terms dimension
    for (let i = 0; i < dimensions.technicalTerms; i++) {
      const termIndex = i % (semanticFeatures.technicalTerms?.length || 1);
      const term = semanticFeatures.technicalTerms?.[termIndex] || '';
      vector.push(term ? hashString(term + i) : 0);
    }

    // Domains dimension
    for (let i = 0; i < dimensions.domains; i++) {
      const domainIndex = i % (semanticFeatures.domains?.length || 1);
      const domain = semanticFeatures.domains?.[domainIndex] || '';
      vector.push(domain ? hashString(domain + i) : 0);
    }

    // Themes dimension
    for (let i = 0; i < dimensions.themes; i++) {
      const themeIndex = i % (semanticFeatures.themes?.length || 1);
      const theme = semanticFeatures.themes?.[themeIndex] || '';
      vector.push(theme ? hashString(theme + i) : 0);
    }

    // Metadata dimensions
    vector.push(semanticFeatures.sentiment === 'positive' ? 1 : semanticFeatures.sentiment === 'negative' ? -1 : 0);
    vector.push(semanticFeatures.complexity === 'high' ? 1 : semanticFeatures.complexity === 'low' ? -1 : 0);
    vector.push(originalText.length / 10000); // Text length normalized
    
    // Fill remaining metadata dimensions with text characteristics
    for (let i = 0; i < dimensions.metadata - 3; i++) {
      vector.push(hashString(originalText.substring(i * 100, (i + 1) * 100)));
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      logger.warn('Vector length mismatch in cosine similarity');
      return 0;
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private async analyzeSimilarityReasons(
    source: WorkItemEmbedding,
    candidate: WorkItemEmbedding,
    similarity: number
  ): Promise<string[]> {
    const reasons: string[] = [];

    // Title similarity
    if (this.textSimilarity(source.title, candidate.title) > 0.7) {
      reasons.push('Very similar titles');
    }

    // Same work item type
    if (source.type === candidate.type) {
      reasons.push(`Both are ${source.type}s`);
    }

    // Semantic similarity score
    if (similarity >= 0.9) {
      reasons.push('Extremely high semantic similarity');
    } else if (similarity >= 0.8) {
      reasons.push('Very high semantic similarity');
    } else if (similarity >= 0.7) {
      reasons.push('High semantic similarity');
    } else {
      reasons.push('Moderate semantic similarity');
    }

    return reasons;
  }

  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private suggestLinkType(
    similarity: number,
    source: WorkItemEmbedding,
    candidate: WorkItemEmbedding
  ): 'Related' | 'Duplicate' | 'Parent' | 'Child' | 'Depends On' {
    if (similarity >= 0.9) {
      return 'Duplicate';
    }

    // Suggest parent/child based on work item types
    const parentTypes = ['Epic', 'Feature'];
    const childTypes = ['User Story', 'Task', 'Bug'];

    if (parentTypes.includes(source.type) && childTypes.includes(candidate.type)) {
      return 'Parent';
    }

    if (childTypes.includes(source.type) && parentTypes.includes(candidate.type)) {
      return 'Child';
    }

    return 'Related';
  }

  private calculateConfidence(similarity: number, reasonsCount: number): number {
    // Confidence based on similarity score and number of reasons
    const similarityWeight = 0.7;
    const reasonsWeight = 0.3;
    
    const reasonsScore = Math.min(reasonsCount / 5, 1); // Max 5 reasons
    
    return (similarity * similarityWeight) + (reasonsScore * reasonsWeight);
  }

  private async clusterSimilarItems(
    sourceEmbeddings: WorkItemEmbedding[],
    candidateEmbeddings: WorkItemEmbedding[]
  ): Promise<Array<{ topicName: string; workItemIds: number[]; avgSimilarity: number }>> {
    // Simple clustering: group items with high inter-similarity
    const allEmbeddings = [...sourceEmbeddings, ...candidateEmbeddings];
    const clusters: Array<{ topicName: string; workItemIds: number[]; avgSimilarity: number }> = [];
    const clustered = new Set<number>();

    for (const emb of allEmbeddings) {
      if (clustered.has(emb.workItemId)) {
        continue;
      }

      const cluster: number[] = [emb.workItemId];
      let totalSimilarity = 0;
      let comparisons = 0;

      for (const other of allEmbeddings) {
        if (emb.workItemId === other.workItemId || clustered.has(other.workItemId)) {
          continue;
        }

        const similarity = this.cosineSimilarity(emb.embedding, other.embedding);
        if (similarity >= 0.7) {
          cluster.push(other.workItemId);
          clustered.add(other.workItemId);
          totalSimilarity += similarity;
          comparisons++;
        }
      }

      if (cluster.length >= 2) {
        clustered.add(emb.workItemId);
        
        // Generate topic name from first item's title
        const topicName = this.extractTopicName(emb.title);
        
        clusters.push({
          topicName,
          workItemIds: cluster,
          avgSimilarity: comparisons > 0 ? totalSimilarity / comparisons : 0
        });
      }
    }

    return clusters;
  }

  private extractTopicName(title: string): string {
    // Extract key words from title
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words = title.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 3);
    
    return words.length > 0 ? words.join(' ') : 'Related Items';
  }

  private calculateCacheHitRate(): number {
    return 0; // Will implement cache statistics tracking
  }

  private getEmbeddingsGenerated(): number {
    return 0; // Will implement statistics tracking
  }

  private loadEmbeddingCache(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const data = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const cacheData = JSON.parse(data);
        
        if (cacheData.version === this.CACHE_VERSION) {
          for (const [id, embedding] of Object.entries(cacheData.embeddings)) {
            this.embeddingCache.set(Number(id), embedding as WorkItemEmbedding);
          }
          logger.info(`Loaded ${this.embeddingCache.size} embeddings from cache`);
        } else {
          logger.info('Cache version mismatch, starting fresh');
        }
      }
    } catch (error) {
      logger.warn(`Failed to load embedding cache: ${error}`);
    }
  }

  private saveEmbeddingCache(): void {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        embeddings: Object.fromEntries(this.embeddingCache)
      };
      
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      logger.debug(`Saved ${this.embeddingCache.size} embeddings to cache`);
    } catch (error) {
      logger.warn(`Failed to save embedding cache: ${error}`);
    }
  }
}
