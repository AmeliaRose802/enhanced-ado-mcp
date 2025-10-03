#!/usr/bin/env node

/**
 * Comprehensive test suite for the Enhanced ADO MCP Server
 * Tests all available tools and their capabilities
 */

import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Enhanced ADO MCP Server - Comprehensive Test Suite');
console.log('===================================================\n');

// Mock MCP client to test the server
class MockMCPClient {
    private serverProcess: ChildProcess | null = null;
    private messageId = 1;

    async startServer(): Promise<boolean> {
        return new Promise((resolve) => {
            console.log('🔄 Starting MCP server...');
            
            this.serverProcess = spawn('node', ['index.js', 'testorg', 'testproject', '--verbose'], {
                cwd: join(__dirname, '..'),
                stdio: 'pipe'
            });

            let hasStarted = false;
            let output = '';

            this.serverProcess.stdout?.on('data', (data) => {
                output += data.toString();
                if (output.includes('MCP server starting') && !hasStarted) {
                    hasStarted = true;
                    console.log('✅ Server started successfully');
                    resolve(true);
                }
            });

            this.serverProcess.stderr?.on('data', (data) => {
                output += data.toString();
                if (output.includes('MCP server starting') && !hasStarted) {
                    hasStarted = true;
                    console.log('✅ Server started successfully');
                    resolve(true);
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!hasStarted) {
                    console.log('❌ Server failed to start within timeout');
                    console.log('Output:', output);
                    resolve(false);
                }
            }, 10000);
        });
    }

    async sendRequest(method: string, params: any = {}): Promise<any> {
        if (!this.serverProcess || !this.serverProcess.stdin) {
            throw new Error('Server not started');
        }

        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: '2.0',
                id: this.messageId++,
                method,
                params
            };

            let response = '';
            const dataHandler = (data: Buffer) => {
                response += data.toString();
                try {
                    const lines = response.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        const parsed = JSON.parse(line);
                        if (parsed.id === request.id) {
                            if (this.serverProcess && this.serverProcess.stdout) {
                                this.serverProcess.stdout.off('data', dataHandler);
                            }
                            resolve(parsed);
                            return;
                        }
                    }
                } catch (e) {
                    // Continue accumulating response
                }
            };

            if (this.serverProcess && this.serverProcess.stdout) {
                this.serverProcess.stdout.on('data', dataHandler);
            }
            
            // Send request
            if (this.serverProcess && this.serverProcess.stdin) {
                this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
            }

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.serverProcess && this.serverProcess.stdout) {
                    this.serverProcess.stdout.off('data', dataHandler);
                }
                reject(new Error(`Request timeout for ${method}`));
            }, 5000);
        });
    }

    stopServer(): void {
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
            this.serverProcess = null;
        }
    }
}

// Test cases
async function runComprehensiveTests() {
    const client = new MockMCPClient();
    let testsRun = 0;
    let testsPassed = 0;

    try {
        // Test 1: Server startup
        console.log('\n📋 Test 1: Server Startup');
        testsRun++;
        const started = await client.startServer();
        if (started) {
            testsPassed++;
            console.log('✅ Server startup test passed');
        } else {
            console.log('❌ Server startup test failed');
            return;
        }

        // Test 2: List tools
        console.log('\n📋 Test 2: List Available Tools');
        testsRun++;
        try {
            const toolsResponse = await client.sendRequest('tools/list');
            if (toolsResponse.result && toolsResponse.result.tools && Array.isArray(toolsResponse.result.tools)) {
                testsPassed++;
                console.log(`✅ Found ${toolsResponse.result.tools.length} tools:`);
                toolsResponse.result.tools.forEach((tool: any) => {
                    console.log(`   - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
                });
            } else {
                console.log('❌ Invalid tools response structure');
            }
        } catch (error) {
            console.log('❌ List tools test failed:', error instanceof Error ? error.message : String(error));
        }

        // Test 3: List prompts
        console.log('\n📋 Test 3: List Available Prompts');
        testsRun++;
        try {
            const promptsResponse = await client.sendRequest('prompts/list');
            if (promptsResponse.result && promptsResponse.result.prompts && Array.isArray(promptsResponse.result.prompts)) {
                testsPassed++;
                console.log(`✅ Found ${promptsResponse.result.prompts.length} prompts:`);
                promptsResponse.result.prompts.forEach((prompt: any) => {
                    console.log(`   - ${prompt.name}: ${prompt.description?.substring(0, 50)}...`);
                });
            } else {
                console.log('❌ Invalid prompts response structure');
            }
        } catch (error) {
            console.log('❌ List prompts test failed:', error instanceof Error ? error.message : String(error));
        }

        // Test 4: Test configuration display
        console.log('\n📋 Test 4: Display Configuration');
        testsRun++;
        try {
            const configResponse = await client.sendRequest('tools/call', {
                name: 'display_effective_merged_configuration',
                arguments: {}
            });
            if (configResponse.result) {
                testsPassed++;
                console.log('✅ Configuration display test passed');
            } else {
                console.log('❌ Configuration display test failed');
            }
        } catch (error) {
            console.log('❌ Configuration display test failed:', error instanceof Error ? error.message : String(error));
        }

        // Wait a bit before stopping
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
        console.log('❌ Test suite error:', error instanceof Error ? error.message : String(error));
    } finally {
        client.stopServer();
    }

    // Summary
    console.log('\n===================================================');
    console.log('🎯 Comprehensive Test Suite Results');
    console.log('===================================================');
    console.log(`Tests Run: ${testsRun}`);
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsRun - testsPassed}`);
    console.log(`Success Rate: ${testsRun > 0 ? Math.round((testsPassed / testsRun) * 100) : 0}%`);
    
    if (testsPassed === testsRun) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Check the output above for details.');
    }
}

// PowerShell scripts have been fully deprecated - all functionality moved to TypeScript handlers
// This test function has been removed as part of tech debt cleanup

// Test configuration files
function testConfigurationFiles() {
    console.log('\n⚙️  Testing Configuration Files');
    console.log('===============================');

    const configPath = join(__dirname, '..', 'mcp-config.json');
    
    if (fs.existsSync(configPath)) {
        console.log('✅ MCP configuration file exists');
        
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            if (config.tools && Array.isArray(config.tools)) {
                console.log(`   ✅ Found ${config.tools.length} tool configurations`);
            }
            
            if (config.prompts && Array.isArray(config.prompts)) {
                console.log(`   ✅ Found ${config.prompts.length} prompt configurations`);
            }
            
            console.log('   ✅ Configuration file is valid JSON');
        } catch (error) {
            console.log('   ❌ Configuration file is invalid:', error instanceof Error ? error.message : String(error));
        }
    } else {
        console.log('❌ MCP configuration file missing');
    }

    // Check package.json
    const packagePath = join(__dirname, '..', 'package.json');
    if (fs.existsSync(packagePath)) {
        console.log('✅ Package.json exists');
        
        try {
            const packageContent = fs.readFileSync(packagePath, 'utf8');
            const packageJson = JSON.parse(packageContent);
            
            if (packageJson.name && packageJson.version) {
                console.log(`   ✅ Package: ${packageJson.name} v${packageJson.version}`);
            }
            
            if (packageJson.scripts && packageJson.scripts.build) {
                console.log('   ✅ Build script configured');
            }
            
        } catch (error) {
            console.log('   ❌ Package.json is invalid:', error instanceof Error ? error.message : String(error));
        }
    } else {
        console.log('❌ Package.json missing');
    }
}

// Main execution
async function main() {
    try {
        // Run configuration tests first (they're quick)
        testConfigurationFiles();
        
        // PowerShell scripts have been deprecated - removed testPowerShellScripts()
        
        // Run comprehensive MCP tests
        await runComprehensiveTests();
        
        console.log('\n🏁 All test suites completed!');
        
    } catch (error) {
        console.error('❌ Test execution failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run the tests
main().catch(console.error);