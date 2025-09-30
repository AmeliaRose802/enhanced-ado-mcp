import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface MCPRequest {
    jsonrpc: string;
    id: number;
    method: string;
    params?: any;
}

interface MCPResponse {
    jsonrpc: string;
    id: number;
    result?: any;
    error?: any;
}

class MCPClient {
    private process: ChildProcess | null = null;
    private requestId = 1;
    private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

    constructor(private serverPath: string, private serverArgs: string[] = []) {}

    async start(): Promise<void> {
        if (this.process) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.process = spawn('node', [this.serverPath, ...this.serverArgs], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            if (!this.process.stdout || !this.process.stdin) {
                reject(new Error('Failed to create MCP server process'));
                return;
            }

            this.process.stdout.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n').filter((line: string) => line.trim());
                for (const line of lines) {
                    try {
                        const response: MCPResponse = JSON.parse(line);
                        const pending = this.pendingRequests.get(response.id);
                        if (pending) {
                            this.pendingRequests.delete(response.id);
                            if (response.error) {
                                pending.reject(new Error(response.error.message || 'MCP Error'));
                            } else {
                                pending.resolve(response.result);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to parse MCP response:', error);
                    }
                }
            });

            this.process.on('error', (error: Error) => {
                reject(error);
            });

            // Initialize the MCP connection
            this.sendRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: 'vscode-ado-mcp',
                    version: '0.1.0'
                }
            }).then(() => {
                resolve();
            }).catch(reject);
        });
    }

    async stop(): Promise<void> {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }

    private sendRequest(method: string, params?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.process || !this.process.stdin) {
                reject(new Error('MCP server not running'));
                return;
            }

            const id = this.requestId++;
            const request: MCPRequest = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };

            this.pendingRequests.set(id, { resolve, reject });
            this.process.stdin.write(JSON.stringify(request) + '\n');

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    async listTools(): Promise<any[]> {
        const result = await this.sendRequest('tools/list');
        return result.tools || [];
    }

    async callTool(name: string, arguments_: any): Promise<any> {
        return await this.sendRequest('tools/call', {
            name,
            arguments: arguments_
        });
    }

    async listPrompts(): Promise<any[]> {
        const result = await this.sendRequest('prompts/list');
        return result.prompts || [];
    }

    async getPrompt(name: string, arguments_?: any): Promise<any> {
        return await this.sendRequest('prompts/get', {
            name,
            arguments: arguments_ || {}
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('ado-mcp');
    const serverPath = config.get<string>('serverPath') || 
                      path.join(context.extensionPath, '..', 'mcp_server', 'dist', 'index.js');
    
    const mcpClient = new MCPClient(serverPath);

    // Auto-start the MCP server if configured
    if (config.get<boolean>('autoStart', true)) {
        mcpClient.start().catch(error => {
            vscode.window.showErrorMessage(`Failed to start MCP server: ${error.message}`);
        });
    }

    // Register commands
    const commands = [
        vscode.commands.registerCommand('ado-mcp.createWorkItem', async () => {
            const title = await vscode.window.showInputBox({
                prompt: 'Enter work item title',
                placeHolder: 'Work item title'
            });
            
            if (!title) return;

            const workItemType = await vscode.window.showQuickPick([
                'Task',
                'Product Backlog Item',
                'Bug',
                'Feature',
                'Epic',
                'User Story'
            ], { placeHolder: 'Select work item type' });

            if (!workItemType) return;

            try {
                const result = await mcpClient.callTool('enhanced-ado-msp-create-new-item', {
                    Title: title,
                    WorkItemType: workItemType
                });
                
                vscode.window.showInformationMessage(`Work item created successfully: ${JSON.stringify(result)}`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to create work item: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('ado-mcp.assignToCopilot', async () => {
            const workItemId = await vscode.window.showInputBox({
                prompt: 'Enter work item ID to assign to Copilot',
                placeHolder: 'Work item ID (number)'
            });
            
            if (!workItemId || isNaN(Number(workItemId))) {
                vscode.window.showErrorMessage('Please enter a valid work item ID');
                return;
            }

            try {
                const result = await mcpClient.callTool('enhanced-ado-msp-assign-to-copilot', {
                    WorkItemId: Number(workItemId)
                });
                
                vscode.window.showInformationMessage(`Work item assigned to Copilot: ${JSON.stringify(result)}`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to assign work item: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('ado-mcp.newCopilotItem', async () => {
            const title = await vscode.window.showInputBox({
                prompt: 'Enter work item title for new Copilot item',
                placeHolder: 'Work item title'
            });
            
            if (!title) return;

            try {
                const result = await mcpClient.callTool('enhanced-ado-msp-new-copilot-item', {
                    Title: title
                });
                
                vscode.window.showInformationMessage(`Copilot work item created: ${JSON.stringify(result)}`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to create Copilot work item: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('ado-mcp.extractSecurityLinks', async () => {
            const workItemId = await vscode.window.showInputBox({
                prompt: 'Enter work item ID to extract security instruction links from',
                placeHolder: 'Work item ID (number)'
            });
            
            if (!workItemId || isNaN(Number(workItemId))) {
                vscode.window.showErrorMessage('Please enter a valid work item ID');
                return;
            }

            try {
                const result = await mcpClient.callTool('wit-extract-security-links', {
                    WorkItemId: Number(workItemId)
                });
                
                vscode.window.showInformationMessage(`Security instruction links extracted: ${JSON.stringify(result)}`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to extract security instruction links: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('ado-mcp.analyzeSecurityItems', async () => {
            try {
                const result = await mcpClient.getPrompt('security_items_analyzer');
                
                // Show the analysis prompt in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: result.messages?.[0]?.content?.text || 'No content available',
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to analyze security items: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('ado-mcp.enhanceWorkItem', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('Please open a text document with work item description');
                return;
            }

            const selection = editor.selection;
            const text = editor.document.getText(selection.isEmpty ? undefined : selection);

            try {
                const result = await mcpClient.getPrompt('work_item_enhancer', {
                    description: text
                });
                
                // Show the enhanced description in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: result.messages?.[0]?.content?.text || 'No enhanced content available',
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to enhance work item: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('ado-mcp.showConfig', async () => {
            try {
                const result = await mcpClient.callTool('wit-get-configuration', { Section: 'all' });
                
                // Show the configuration in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(result, null, 2),
                    language: 'json'
                });
                
                await vscode.window.showTextDocument(doc);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to show configuration: ${error.message}`);
            }
        })
    ];

    context.subscriptions.push(...commands);

    // Clean up on deactivate
    context.subscriptions.push({
        dispose: () => {
            mcpClient.stop();
        }
    });
}

export function deactivate() {
    // Extension cleanup happens in dispose above
}