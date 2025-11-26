# AI-Powered Work Item Similarity Detection

**Version:** 1.0.0  
**Created:** 2025-11-18  
**Status:** Implemented  
**Tool Name:** `find-similar-work-items`  
**Requires:** VS Code with sampling support

## Overview

The similarity detection feature uses AI-generated semantic embeddings to find similar work items based on titles, descriptions, and acceptance criteria. It helps identify:

- **Duplicates**: Items with >90% similarity that may be redundant
- **Related Items**: Items with 60-90% similarity that should be linked
- **Topic Clusters**: Groups of similar items organized by theme
- **Smart Link Suggestions**: Recommendations for appropriate relationship types

## Key Features

### Semantic Understanding
- Analyzes content meaning, not just keywords
- Understands technical concepts and domain terminology
- Recognizes themes and patterns across work items
- Weighs titles more heavily (3x) for better matching

### Persistent Caching
- Embeddings stored in `%TEMP%\enhanced-ado-mcp\embeddings\`
- Avoids regenerating embeddings for unchanged items
- Fast similarity comparison on subsequent queries
- Cache persists across MCP server sessions

### Efficient Comparison
- Uses cosine similarity on embedding vectors
- Batch processing for multiple work items
- Limits candidate items to 200 per query for performance
- Configurable similarity thresholds

### AI-Powered Analysis
- Generates semantic features: concepts, technical terms, domains, themes
- Converts features to embedding vectors (128 dimensions)
- Provides similarity reasoning and confidence scores
- Suggests appropriate link types based on work item types

## Input Parameters

### Required (one of)
- `workItemId` (number): Single work item to find similar items for
- `queryHandle` (string): Query handle containing work items to analyze

### Optional
- `similarityThreshold` (number, 0-1, default: 0.6): Minimum similarity score
  - `0.9-1.0`: Likely duplicates
  - `0.7-0.9`: Strongly related
  - `0.6-0.7`: Moderately related
- `maxResults` (number, default: 20, max: 100): Max similar items per source
- `includeEmbeddings` (boolean, default: false): Include vectors in response (large)
- `skipCache` (boolean, default: false): Regenerate embeddings
- `analysisType` (enum, default: 'all'):
  - `'duplicates'`: Only items with >90% similarity
  - `'related'`: Only items with 60-90% similarity
  - `'cluster'`: Group similar items by topic
  - `'all'`: All analysis types
- `organization` (string, optional): Override default organization
- `project` (string, optional): Override default project

## Output Format

### Single Work Item Analysis

```json
{
  "success": true,
  "data": {
    "sourceWorkItem": {
      "id": 12345,
      "title": "Implement user authentication",
      "type": "Product Backlog Item"
    },
    "similarItems": [
      {
        "workItemId": 12346,
        "title": "Add login functionality",
        "type": "Product Backlog Item",
        "state": "Active",
        "similarityScore": 0.92,
        "reasons": [
          "Very similar titles",
          "Both are Product Backlog Items",
          "Extremely high semantic similarity"
        ],
        "suggestedLinkType": "Duplicate",
        "confidence": 0.89
      },
      {
        "workItemId": 12350,
        "title": "Create user profile API",
        "type": "Task",
        "state": "Active",
        "similarityScore": 0.75,
        "reasons": [
          "Both are Tasks",
          "High semantic similarity"
        ],
        "suggestedLinkType": "Related",
        "confidence": 0.68
      }
    ],
    "duplicateCandidates": [
      {
        "workItemId": 12346,
        "title": "Add login functionality",
        "similarityScore": 0.92,
        ...
      }
    ],
    "relatedCandidates": [
      {
        "workItemId": 12350,
        "title": "Create user profile API",
        "similarityScore": 0.75,
        ...
      }
    ],
    "clusters": [
      {
        "topicName": "authentication user login",
        "workItemIds": [12345, 12346, 12347],
        "avgSimilarity": 0.87
      }
    ],
    "analysisMetadata": {
      "totalCompared": 147,
      "cacheHitRate": 0.78,
      "embeddingsGenerated": 32,
      "analysisType": "all"
    }
  },
  "metadata": {
    "source": "similarity-service",
    "itemsAnalyzed": 1,
    "threshold": 0.6,
    "maxResults": 20
  }
}
```

### Query Handle Batch Analysis

When using `queryHandle`, returns an array of results, one per source work item:

```json
{
  "success": true,
  "data": [
    { "sourceWorkItem": {...}, "similarItems": [...], ... },
    { "sourceWorkItem": {...}, "similarItems": [...], ... }
  ]
}
```

## Use Cases

### 1. Duplicate Detection During Creation

Before creating a new work item, check for duplicates:

```javascript
// Query for recent items in same area
const query = await mcp.call('query-wiql', {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] = 'MyProject\\MyArea' AND [System.CreatedDate] > @Today - 90",
  returnQueryHandle: true,
  handleOnly: true
});

// Check if new item is duplicate
const similarity = await mcp.call('find-similar-work-items', {
  workItemId: newItemId,
  analysisType: 'duplicates',
  similarityThreshold: 0.9
});

if (similarity.data.duplicateCandidates.length > 0) {
  console.warn('Possible duplicates found:', similarity.data.duplicateCandidates);
}
```

### 2. Find Related Work for Context

Discover related items when working on a feature:

```javascript
const similar = await mcp.call('find-similar-work-items', {
  workItemId: 12345,
  analysisType: 'related',
  similarityThreshold: 0.7,
  maxResults: 10
});

// Link related items
for (const item of similar.data.relatedCandidates) {
  console.log(`Consider linking to #${item.workItemId}: ${item.title}`);
}
```

### 3. Cluster Backlog by Theme

Group backlog items into thematic clusters:

```javascript
// Get backlog items
const backlog = await mcp.call('query-wiql', {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  returnQueryHandle: true,
  handleOnly: true
});

// Cluster by similarity
const clusters = await mcp.call('find-similar-work-items', {
  queryHandle: backlog.data.query_handle,
  analysisType: 'cluster',
  similarityThreshold: 0.7
});

// Review clusters
for (const cluster of clusters.data[0].clusters) {
  console.log(`Topic: ${cluster.topicName}`);
  console.log(`Items: ${cluster.workItemIds.join(', ')}`);
}
```

### 4. Suggest Parent Work Items

Find potential parents based on content similarity:

```javascript
// Get orphaned tasks
const orphans = await mcp.call('query-wiql', {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND [System.Parent] = ''",
  returnQueryHandle: true,
  handleOnly: true
});

// Find similar features/epics
const parentCandidates = await mcp.call('find-similar-work-items', {
  queryHandle: orphans.data.query_handle,
  similarityThreshold: 0.7
});

for (const result of parentCandidates.data) {
  const parents = result.similarItems.filter(s => 
    (s.type === 'Feature' || s.type === 'Epic') && 
    s.suggestedLinkType === 'Parent'
  );
  
  if (parents.length > 0) {
    console.log(`Task #${result.sourceWorkItem.id} could be child of:`);
    parents.forEach(p => console.log(`  - #${p.workItemId}: ${p.title}`));
  }
}
```

## Implementation Details

### Embedding Generation Process

1. **Text Preparation**
   - Extracts title, description, acceptance criteria
   - Removes HTML tags from description
   - Weights title 3x by repeating it
   - Combines: `title | title | title | description | acceptance_criteria`

2. **Semantic Feature Extraction**
   - Uses AI to identify: concepts, technical terms, domains, themes
   - Assesses sentiment (positive/neutral/negative) and complexity (low/medium/high)
   - Returns structured JSON with semantic features

3. **Vector Conversion**
   - Converts semantic features to 128-dimension vector
   - Uses hash functions to map strings to numbers
   - Allocates dimensions: 40 concepts, 30 technical terms, 20 domains, 20 themes, 18 metadata
   - Normalizes vector to unit length

4. **Caching**
   - Stores embedding with metadata (workItemId, title, type, state, text, timestamp)
   - Cache file: `%TEMP%\enhanced-ado-mcp\embeddings\work-item-embeddings.json`
   - Version-controlled cache format for compatibility

### Similarity Calculation

Uses **cosine similarity** for comparison:

```
similarity = (vec1 · vec2) / (||vec1|| * ||vec2||)
```

- Range: 0 (completely different) to 1 (identical)
- Efficient for high-dimensional vectors
- Captures semantic similarity regardless of text length

### Performance Optimizations

1. **Batch Processing**
   - Generates embeddings in batches of 10
   - Processes work items concurrently where possible

2. **Candidate Limiting**
   - Fetches max 200 candidate items from same area path
   - Prioritizes recent items (ordered by ChangedDate DESC)

3. **Cache Strategy**
   - Loads cache on service initialization
   - Saves cache after analysis completes
   - Persistent across sessions

4. **Result Limiting**
   - Returns top N most similar items (default 20, max 100)
   - Sorts by similarity score descending

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| "Query handle not found or expired" | Invalid/expired query handle | Query handles expire after 24 hours. Re-run WIQL query |
| "Either workItemId or queryHandle must be provided" | Missing required parameter | Provide one of workItemId or queryHandle |
| "Similarity service not initialized" | No sampling support | Requires VS Code with language model access |
| "Failed to fetch work items" | API error or invalid IDs | Check work item IDs exist and you have permissions |
| "Failed to generate embedding" | AI timeout or error | Retry with fewer items or simpler content |

### Graceful Degradation

- If embedding generation fails for an item, logs warning and continues
- Returns empty arrays if no similar items found
- Cache failures logged as warnings, doesn't fail operation

## Testing

### Manual Testing Steps

1. **Test Duplicate Detection**
   ```bash
   # Create two similar items
   # Then test similarity
   ```

2. **Test Cache Persistence**
   ```bash
   # First run - generates embeddings
   # Second run - should use cache (check logs)
   ```

3. **Test Clustering**
   ```bash
   # Query backlog items
   # Run clustering analysis
   # Verify thematic groupings make sense
   ```

### Verification

Check logs for:
- "Loaded N embeddings from cache" (cache working)
- "Generating embeddings for N work items" (new embeddings)
- "Saved N embeddings to cache" (persistence working)

## Limitations

1. **Approximate Embeddings**: Not true neural embeddings, but semantic feature vectors
2. **Candidate Scope**: Limited to 200 items per query for performance
3. **Same Area Path**: Only compares items from same area path
4. **Language Support**: Works best with English content
5. **Cache Size**: Large projects may accumulate large cache files (monitor %TEMP% usage)

## Future Enhancements

Potential improvements for future versions:

1. **True Neural Embeddings**: Use actual embedding models when available
2. **Cross-Area Comparison**: Option to compare across multiple area paths
3. **Approximate Nearest Neighbors**: Use ANN algorithms for massive datasets (10k+ items)
4. **Incremental Updates**: Only regenerate embeddings for changed items
5. **Embedding Visualization**: t-SNE or UMAP plots for cluster visualization
6. **Multi-Language Support**: Better handling of non-English content
7. **Custom Similarity Models**: Fine-tune on project-specific terminology

## Version History

### 1.0.0 (2025-11-18)
- Initial implementation
- Semantic feature extraction using AI
- 128-dimension pseudo-embedding vectors
- Persistent caching support
- Duplicate, related, and cluster analysis modes
- Integration with query handles for batch processing

## See Also

- [Query Handle Pattern](./QUERY_HANDLE_PATTERN.md)
- [AI-Powered Features](./AI_POWERED_FEATURES.md)
- [Parent Recommendation](./HIERARCHY_ANALYSIS_WITH_HANDLES.md)
- [Bulk Operations](./BULK_OPERATIONS.md)
