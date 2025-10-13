#!/usr/bin/env node

/**
 * Basic smoke test for the Enhanced ADO MCP Server
 * Tests basic functionality without requiring real ADO credentials
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Enhanced ADO MCP Server - Smoke Test Suite');
console.log('===============================================\n');

// Test 1: Version check
console.log('Test 1: Version Check');
try {
    const versionProcess = spawn('node', ['index.js', '--version'], {
        cwd: join(__dirname, '..'),
        stdio: 'pipe'
    });
    
    let output = '';
    versionProcess.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    versionProcess.on('close', (code) => {
        if (code === 0 && output.trim().match(/^\d+\.\d+\.\d+$/)) {
            console.log('✅ Version check passed:', output.trim());
        } else {
            console.log('❌ Version check failed');
        }
        runHelpTest();
    });
} catch (error) {
    console.log('❌ Version test error:', error instanceof Error ? error.message : String(error));
    runHelpTest();
}

// Test 2: Help command
function runHelpTest() {
    console.log('\nTest 2: Help Command');
    try {
        const helpProcess = spawn('node', ['index.js', '--help'], {
            cwd: join(__dirname, '..'),
            stdio: 'pipe'
        });
        
        let output = '';
        helpProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        helpProcess.on('close', (code) => {
            if (code === 0 && output.includes('Usage:') && output.includes('organization') && output.includes('project')) {
                console.log('✅ Help command passed');
            } else {
                console.log('❌ Help command failed');
            }
            runStartupTest();
        });
    } catch (error) {
        console.log('❌ Help test error:', error instanceof Error ? error.message : String(error));
        runStartupTest();
    }
}

// Test 3: Startup test (quick exit)
function runStartupTest() {
    console.log('\nTest 3: Server Startup Test');
    try {
        const serverProcess = spawn('node', ['index.js', 'testorg', 'testproject', '--verbose'], {
            cwd: join(__dirname, '..'),
            stdio: 'pipe'
        });
        
        let output = '';
        let hasStarted = false;
        
        serverProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('MCP server starting')) {
                hasStarted = true;
                serverProcess.kill('SIGTERM');
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            output += data.toString();
            if (output.includes('MCP server starting')) {
                hasStarted = true;
                serverProcess.kill('SIGTERM');
            }
        });
        
        // Kill after 5 seconds if it hasn't started
        setTimeout(() => {
            if (!hasStarted) {
                serverProcess.kill('SIGTERM');
            }
        }, 5000);
        
        serverProcess.on('close', (code) => {
            if (hasStarted) {
                console.log('✅ Server startup test passed');
            } else {
                console.log('❌ Server startup test failed - no startup message detected');
                console.log('Output:', output);
            }
            runConfigTest();
        });
    } catch (error) {
        console.log('❌ Startup test error:', error instanceof Error ? error.message : String(error));
        runConfigTest();
    }
}

// Test 4: Configuration validation
function runConfigTest() {
    console.log('\nTest 4: Configuration Test');
    try {
        const configProcess = spawn('node', ['index.js', 'testorg', 'testproject', '--config', 'mcp-config.json'], {
            cwd: join(__dirname, '..'),
            stdio: 'pipe'
        });
        
        let hasStarted = false;
        let output = '';
        
        configProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('MCP server starting')) {
                hasStarted = true;
                configProcess.kill('SIGTERM');
            }
        });
        
        configProcess.stderr.on('data', (data) => {
            output += data.toString();
            if (output.includes('MCP server starting')) {
                hasStarted = true;
                configProcess.kill('SIGTERM');
            }
        });
        
        setTimeout(() => {
            if (!hasStarted) {
                configProcess.kill('SIGTERM');
            }
        }, 5000);
        
        configProcess.on('close', (code) => {
            if (hasStarted) {
                console.log('✅ Configuration test passed');
            } else {
                console.log('❌ Configuration test failed');
            }
            printSummary();
        });
    } catch (error) {
        console.log('❌ Configuration test error:', error instanceof Error ? error.message : String(error));
        printSummary();
    }
}

function printSummary() {
    console.log('\n===============================================');
    console.log('🎯 Smoke Test Suite Complete');
    console.log('===============================================');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run integration tests with real ADO credentials');
    console.log('2. Test MCP protocol compliance');
    console.log('3. Test all tool endpoints');
    console.log('4. Validate PowerShell script execution');
}