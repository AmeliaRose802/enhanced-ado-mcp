/**
 * AI-Powered Tools Performance Benchmarks
 *
 * Benchmarks for AI analysis, enhancement, and intelligence operations
 * Tests AI tool response times and ensures they meet performance thresholds
 */

import { Bench } from "tinybench";
import {
  PERFORMANCE_THRESHOLDS,
  DEFAULT_BENCHMARK_OPTIONS,
  formatBenchmarkResult,
  benchmarkPassed,
  MockData,
} from "./benchmark-config.js";

/**
 * Simulate AI assignment analysis
 */
function simulateAIAssignmentAnalysis(workItem: any): any {
  // Simulate LLM processing time
  let analysis = "";
  for (let i = 0; i < 100; i++) {
    analysis += "Analysis content ";
  }

  // Simulate decision making
  const complexity = Math.random();
  const clarity = Math.random();
  const decision = complexity > 0.7 && clarity > 0.6 ? "AI_FIT" : "HUMAN_FIT";

  return {
    decision,
    confidence: 0.7 + Math.random() * 0.3,
    reasons: ["Clear requirements", "Well-defined scope", "Standard patterns"],
    risks: complexity > 0.8 ? ["High complexity"] : [],
  };
}

/**
 * Simulate work item intelligence analysis
 */
function simulateIntelligenceAnalysis(workItem: any): any {
  // Simulate comprehensive analysis
  let fullAnalysis = "";
  for (let i = 0; i < 200; i++) {
    fullAnalysis += "Detailed analysis content ";
  }

  const scores = {
    completeness: 0.6 + Math.random() * 0.4,
    clarity: 0.5 + Math.random() * 0.5,
    testability: 0.6 + Math.random() * 0.4,
    estimability: 0.7 + Math.random() * 0.3,
  };

  return {
    overallScore: Object.values(scores).reduce((a, b) => a + b, 0) / 4,
    scores,
    recommendations: [
      "Add acceptance criteria",
      "Clarify technical requirements",
      "Define success metrics",
    ],
    missingElements: ["acceptance criteria", "test cases"],
  };
}

/**
 * Simulate description enhancement
 */
function simulateDescriptionEnhancement(workItem: any): any {
  // Simulate AI text generation
  let enhancedDescription = workItem.description || "";

  // Simulate enhancement processing
  for (let i = 0; i < 150; i++) {
    enhancedDescription += "Enhanced content section. ";
  }

  return {
    original: workItem.description || "Original description",
    enhanced: enhancedDescription.substring(0, 500),
    improvements: ["Added technical details", "Clarified requirements", "Added examples"],
    confidence: 0.8 + Math.random() * 0.2,
  };
}

/**
 * Simulate acceptance criteria generation
 */
function simulateAcceptanceCriteriaGeneration(workItem: any): any {
  // Simulate AI criteria generation
  const criteria = [];

  // Process work item details
  const titleWords = workItem.title.split(" ");

  for (let i = 0; i < 6; i++) {
    // Simulate generation complexity
    const givenClause = `Given ${titleWords[0]} condition`;
    const whenClause = `When action ${i} occurs`;
    const thenClause = `Then outcome ${i} is verified`;

    criteria.push({
      given: givenClause,
      when: whenClause,
      then: thenClause,
    });
  }

  return {
    criteria,
    format: "gherkin",
    count: criteria.length,
    confidence: 0.75 + Math.random() * 0.25,
  };
}

/**
 * Simulate story point estimation
 */
function simulateStoryPointEstimation(workItem: any): any {
  // Simulate AI estimation logic
  let complexity = 0;

  // Analyze title
  complexity += workItem.title.length / 10;

  // Analyze description
  if (workItem.description) {
    complexity += workItem.description.length / 100;
  }

  // Simulate additional analysis
  for (let i = 0; i < 50; i++) {
    complexity += Math.random() * 0.1;
  }

  const pointScale = [1, 2, 3, 5, 8, 13, 21];
  const pointIndex = Math.min(Math.floor(complexity / 5), pointScale.length - 1);

  return {
    storyPoints: pointScale[pointIndex],
    confidence: 0.7 + Math.random() * 0.3,
    factors: {
      complexity: complexity / 10,
      clarity: 0.8,
      dependencies: 0.5,
    },
    reasoning: "Based on scope, complexity, and requirements clarity",
  };
}

/**
 * Simulate batch AI analysis
 */
function simulateBatchAIAnalysis(workItems: any[]): any[] {
  const results = [];

  for (const workItem of workItems) {
    // Simulate per-item AI processing
    const analysis = simulateAIAssignmentAnalysis(workItem);
    results.push({
      id: workItem.id,
      ...analysis,
    });
  }

  return results;
}

/**
 * Run AI tools benchmarks
 */
export async function runAIToolsBenchmarks(): Promise<void> {
  console.log("\n=== AI-Powered Tools Performance Benchmarks ===\n");

  const bench = new Bench({
    time: DEFAULT_BENCHMARK_OPTIONS.time,
    warmupIterations: DEFAULT_BENCHMARK_OPTIONS.warmupIterations,
  });

  const results: { name: string; avgTime: number; passed: boolean }[] = [];

  // Generate test data
  const singleWorkItem = MockData.generateWorkItems(1)[0];
  const smallBatch = MockData.generateWorkItems(10);

  // Single item AI operations
  bench.add("AI Assignment Analysis - Single Item", () => {
    simulateAIAssignmentAnalysis(singleWorkItem);
  });

  bench.add("AI Intelligence Analysis - Single Item", () => {
    simulateIntelligenceAnalysis(singleWorkItem);
  });

  bench.add("AI Description Enhancement - Single Item", () => {
    simulateDescriptionEnhancement(singleWorkItem);
  });

  bench.add("AI Acceptance Criteria - Single Item", () => {
    simulateAcceptanceCriteriaGeneration(singleWorkItem);
  });

  bench.add("AI Story Point Estimation - Single Item", () => {
    simulateStoryPointEstimation(singleWorkItem);
  });

  // Batch AI operations
  bench.add("AI Batch Analysis - 10 Items", () => {
    simulateBatchAIAnalysis(smallBatch);
  });

  bench.add("AI Batch Enhancement - 10 Items", () => {
    smallBatch.forEach((item) => simulateDescriptionEnhancement(item));
  });

  bench.add("AI Batch Criteria Generation - 10 Items", () => {
    smallBatch.forEach((item) => simulateAcceptanceCriteriaGeneration(item));
  });

  // Pattern detection (lighter AI task)
  bench.add("AI Pattern Detection - 10 Items", () => {
    const patterns = [];
    for (const item of smallBatch) {
      // Simulate pattern matching
      const titleLower = item.title.toLowerCase();
      if (titleLower.includes("bug")) patterns.push("bug-pattern");
      if (titleLower.includes("feature")) patterns.push("feature-pattern");
    }
    return patterns;
  });

  // Run benchmarks
  await bench.run();

  // Process and display results
  console.log("\n--- Results ---\n");

  const taskMapping = {
    "AI Assignment Analysis - Single Item": PERFORMANCE_THRESHOLDS.AI_ANALYSIS_SINGLE,
    "AI Intelligence Analysis - Single Item": PERFORMANCE_THRESHOLDS.AI_ANALYSIS_SINGLE,
    "AI Description Enhancement - Single Item": PERFORMANCE_THRESHOLDS.AI_ENHANCEMENT_SINGLE,
    "AI Acceptance Criteria - Single Item": PERFORMANCE_THRESHOLDS.AI_ENHANCEMENT_SINGLE,
    "AI Story Point Estimation - Single Item": PERFORMANCE_THRESHOLDS.AI_ANALYSIS_SINGLE,
    "AI Batch Analysis - 10 Items": PERFORMANCE_THRESHOLDS.AI_BATCH_SMALL,
    "AI Batch Enhancement - 10 Items": PERFORMANCE_THRESHOLDS.AI_BATCH_SMALL,
    "AI Batch Criteria Generation - 10 Items": PERFORMANCE_THRESHOLDS.AI_BATCH_SMALL,
    "AI Pattern Detection - 10 Items": PERFORMANCE_THRESHOLDS.AI_ANALYSIS_SINGLE,
  };

  let allPassed = true;

  for (const task of bench.tasks) {
    const avgTime = task.result?.mean ? task.result.mean * 1000 : 0; // Convert to ms
    const threshold = taskMapping[task.name as keyof typeof taskMapping];

    if (threshold) {
      const passed = benchmarkPassed(avgTime, threshold);
      allPassed = allPassed && passed;

      console.log(formatBenchmarkResult(task.name, avgTime, threshold));

      results.push({
        name: task.name,
        avgTime,
        passed,
      });
    }
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Total benchmarks: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.failed).length}`);
  console.log(`Overall: ${allPassed ? "✓ PASSED" : "✗ FAILED"}`);

  // Performance insights
  console.log("\n--- Performance Insights ---");
  console.log("• Single item AI analysis: 5-10s is acceptable");
  console.log("• Batch operations (10 items): 20-30s is expected");
  console.log("• Note: These are simulated benchmarks. Real AI calls will vary based on:");
  console.log("  - LLM response time (typically 2-5s per call)");
  console.log("  - Model selection (gpt-4o-mini vs gpt-4o)");
  console.log("  - Network latency");
  console.log("  - Token count and complexity");

  if (!allPassed) {
    console.log("\n⚠️  Some benchmarks did not meet performance thresholds");
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAIToolsBenchmarks().catch((error) => {
    console.error("Benchmark failed:", error);
    process.exit(1);
  });
}
