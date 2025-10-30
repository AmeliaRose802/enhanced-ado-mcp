/**
 * Health Check Handler
 * 
 * Provides health status information for the MCP server and its dependencies.
 */

import type { ToolConfig, ToolExecutionResult } from '@/types/index.js';
import { metricsService } from '../../metrics-service.js';
import { validateAndParse } from '@/utils/handler-helpers.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    server: HealthStatus;
    azureDevOps: HealthStatus;
    azureCLI: HealthStatus;
    sampling?: HealthStatus;
  };
  uptime: number;
  version: string;
  timestamp: string;
  metrics?: {
    totalRequests: number;
    errorRate: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
}

export async function handleHealthCheck(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  const validation = validateAndParse(config.schema, args);
  if (!validation.success) {
    return validation.error;
  }

  const parsed = validation.data as {
    includeMetrics?: boolean;
    includeADOStatus?: boolean;
    includeAzureCLIStatus?: boolean;
  };

  try {
    const checks: HealthCheckResult['checks'] = {
      server: { status: 'healthy', message: 'Server running' },
      azureDevOps: parsed.includeADOStatus !== false ? await checkADOConnection() : { status: 'healthy', message: 'Skipped' },
      azureCLI: parsed.includeAzureCLIStatus !== false ? await checkAzureCLI() : { status: 'healthy', message: 'Skipped' }
    };

    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
    const anyDegraded = Object.values(checks).some(c => c.status === 'degraded');
    
    const overallStatus = allHealthy ? 'healthy' : (anyDegraded ? 'degraded' : 'unhealthy');

    const result: HealthCheckResult = {
      status: overallStatus,
      checks,
      uptime: metricsService.getUptime(),
      version: '1.8.0',
      timestamp: new Date().toISOString()
    };

    // Add metrics if requested
    if (parsed.includeMetrics !== false) {
      const snapshot = metricsService.getSnapshot();
      const totalRequests = Object.entries(snapshot.counters)
        .filter(([key]) => key.includes('tool_execution'))
        .reduce((sum, [, val]) => sum + val, 0);
      const errorCount = metricsService.getCounter('tool_execution_error');
      const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

      result.metrics = {
        totalRequests,
        errorRate
      };
    }

    return {
      success: allHealthy,
      data: result as unknown as Record<string, unknown>,
      errors: allHealthy ? [] : ['Some health checks failed'],
      warnings: anyDegraded ? ['System is degraded'] : [],
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      metadata: {}
    };
  }
}

async function checkADOConnection(): Promise<HealthStatus> {
  try {
    const startTime = Date.now();
    await execAsync('az account show');
    const latency = Date.now() - startTime;
    
    return {
      status: latency < 1000 ? 'healthy' : 'degraded',
      message: 'Azure CLI authenticated',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error && error.message.includes('az') ? 
        'Azure CLI not authenticated' :
        `Azure CLI check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function checkAzureCLI(): Promise<HealthStatus> {
  try {
    await execAsync('az --version');
    return {
      status: 'healthy',
      message: 'Azure CLI available'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Azure CLI not installed or not found'
    };
  }
}
