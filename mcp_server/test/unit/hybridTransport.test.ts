/**
 * HybridStdioServerTransport Unit Tests
 * 
 * Tests for the critical transport layer that handles JSON-RPC message routing
 * between stdio and SSE (Server-Sent Events).
 * 
 * Coverage target: 40-50% initial coverage for critical paths
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter, PassThrough } from 'node:stream';
import { HybridStdioServerTransport } from '../../src/hybridTransport.js';

describe('HybridStdioServerTransport', () => {
  let mockStdin: PassThrough;
  let mockStdout: PassThrough;
  let transport: HybridStdioServerTransport;
  
  beforeEach(() => {
    // Create mock streams that mimic Node.js stdin/stdout
    mockStdin = new PassThrough();
    mockStdout = new PassThrough();
    
    // Create transport with mock streams
    transport = new HybridStdioServerTransport(
      mockStdin as any,
      mockStdout as any
    );
  });
  
  afterEach(() => {
    // Clean up
    mockStdin.destroy();
    mockStdout.destroy();
  });
  
  describe('Transport Initialization', () => {
    it('should create transport with default streams', () => {
      const defaultTransport = new HybridStdioServerTransport();
      expect(defaultTransport).toBeDefined();
    });
    
    it('should create transport with custom streams', () => {
      expect(transport).toBeDefined();
    });
    
    it('should start successfully', async () => {
      await expect(transport.start()).resolves.toBeUndefined();
    });
    
    it('should throw error when starting already started transport', async () => {
      await transport.start();
      await expect(transport.start()).rejects.toThrow('HybridStdioServerTransport already started');
    });
    
    it('should close successfully', async () => {
      await transport.start();
      await expect(transport.close()).resolves.toBeUndefined();
    });
    
    it('should trigger onclose callback when closed', async () => {
      await transport.start();
      
      const onCloseSpy = jest.fn();
      transport.onclose = onCloseSpy;
      
      await transport.close();
      
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Message Sending', () => {
    beforeEach(async () => {
      await transport.start();
    });
    
    it('should send message with Content-Length framing by default', async () => {
      const message = { jsonrpc: '2.0', method: 'test', params: {} };
      const writtenData: Buffer[] = [];
      
      mockStdout.on('data', (chunk) => {
        writtenData.push(chunk);
      });
      
      await transport.send(message);
      
      const output = Buffer.concat(writtenData).toString('utf8');
      expect(output).toContain('Content-Length:');
      expect(output).toContain('\r\n\r\n');
      expect(output).toContain(JSON.stringify(message));
    });
    
    it('should send message with newline framing when MCP_FORCE_NEWLINE=1', async () => {
      process.env.MCP_FORCE_NEWLINE = '1';
      
      // Create new transport with env var set
      const nlTransport = new HybridStdioServerTransport(
        mockStdin as any,
        mockStdout as any
      );
      await nlTransport.start();
      
      const message = { jsonrpc: '2.0', method: 'test', params: {} };
      const writtenData: Buffer[] = [];
      
      mockStdout.on('data', (chunk) => {
        writtenData.push(chunk);
      });
      
      await nlTransport.send(message);
      
      const output = Buffer.concat(writtenData).toString('utf8');
      expect(output).not.toContain('Content-Length:');
      expect(output).toContain('\n');
      expect(output).toBe(JSON.stringify(message) + '\n');
      
      delete process.env.MCP_FORCE_NEWLINE;
      await nlTransport.close();
    });
    
    it('should send message with Content-Length framing when MCP_FORCE_CONTENT_LENGTH=1', async () => {
      process.env.MCP_FORCE_CONTENT_LENGTH = '1';
      
      const clTransport = new HybridStdioServerTransport(
        mockStdin as any,
        mockStdout as any
      );
      await clTransport.start();
      
      const message = { jsonrpc: '2.0', method: 'test', params: {} };
      const writtenData: Buffer[] = [];
      
      mockStdout.on('data', (chunk) => {
        writtenData.push(chunk);
      });
      
      await clTransport.send(message);
      
      const output = Buffer.concat(writtenData).toString('utf8');
      expect(output).toContain('Content-Length:');
      expect(output).toContain('\r\n\r\n');
      
      delete process.env.MCP_FORCE_CONTENT_LENGTH;
      await clTransport.close();
    });
    
    it('should calculate correct Content-Length for UTF-8 strings', async () => {
      const message = { emoji: '🚀', text: 'Hello, 世界!' };
      const writtenData: Buffer[] = [];
      
      mockStdout.on('data', (chunk) => {
        writtenData.push(chunk);
      });
      
      await transport.send(message);
      
      const output = Buffer.concat(writtenData).toString('utf8');
      const json = JSON.stringify(message);
      const expectedLength = Buffer.byteLength(json, 'utf8');
      
      expect(output).toContain(`Content-Length: ${expectedLength}`);
    });
    
    it('should handle backpressure with drain event', async () => {
      const message = { jsonrpc: '2.0', method: 'test' };
      
      // Mock stdout.write to return false (backpressure)
      let drainCallback: (() => void) | undefined;
      const mockWrite = jest.fn().mockReturnValue(false);
      const mockOnce = jest.fn((event: string, callback: () => void) => {
        if (event === 'drain') {
          drainCallback = callback;
        }
      });
      
      mockStdout.write = mockWrite as any;
      mockStdout.once = mockOnce as any;
      
      const sendPromise = transport.send(message);
      
      // Verify write was called
      expect(mockWrite).toHaveBeenCalled();
      expect(mockOnce).toHaveBeenCalledWith('drain', expect.any(Function));
      
      // Trigger drain event
      if (drainCallback !== undefined) {
        drainCallback();
      }
      
      await sendPromise;
    });
  });
  
  describe('Message Receiving - Content-Length Framing', () => {
    beforeEach(async () => {
      await transport.start();
    });
    
    it('should receive complete Content-Length framed message', (done) => {
      const message = { jsonrpc: '2.0', method: 'test', params: { foo: 'bar' } };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
    
    it('should handle message arriving in multiple chunks', (done) => {
      const message = { jsonrpc: '2.0', method: 'test', params: { foo: 'bar' } };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      // Send in chunks
      const midpoint = Math.floor(payload.length / 2);
      mockStdin.write(payload.slice(0, midpoint));
      setTimeout(() => {
        mockStdin.write(payload.slice(midpoint));
      }, 10);
    });
    
    it('should handle multiple messages in one chunk', async () => {
      const messages: any[] = [];
      const message1 = { jsonrpc: '2.0', id: 1, method: 'test1' };
      const message2 = { jsonrpc: '2.0', id: 2, method: 'test2' };
      
      const json1 = JSON.stringify(message1);
      const json2 = JSON.stringify(message2);
      const payload1 = `Content-Length: ${Buffer.byteLength(json1, 'utf8')}\r\n\r\n${json1}`;
      const payload2 = `Content-Length: ${Buffer.byteLength(json2, 'utf8')}\r\n\r\n${json2}`;
      
      transport.onmessage = (msg) => {
        messages.push(msg);
      };
      
      mockStdin.write(payload1 + payload2);
      
      // Give time for processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(message1);
      expect(messages[1]).toEqual(message2);
    });
    
    it('should handle UTF-8 characters in Content-Length framed messages', (done) => {
      const message = { emoji: '🎉', text: '你好世界', nested: { symbol: '€' } };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
    
    it('should wait for complete message body before parsing', (done) => {
      const message = { jsonrpc: '2.0', method: 'test', params: { data: 'x'.repeat(1000) } };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      let messageReceived = false;
      transport.onmessage = (msg) => {
        messageReceived = true;
        expect(msg).toEqual(message);
      };
      
      // Send header and partial body
      const headerEnd = payload.indexOf('\r\n\r\n') + 4;
      mockStdin.write(payload.slice(0, headerEnd + 10));
      
      // Verify message not received yet
      setTimeout(() => {
        expect(messageReceived).toBe(false);
        
        // Send rest of body
        mockStdin.write(payload.slice(headerEnd + 10));
        
        setTimeout(() => {
          expect(messageReceived).toBe(true);
          done();
        }, 20);
      }, 20);
    });
  });
  
  describe('Message Receiving - Newline Framing', () => {
    beforeEach(async () => {
      await transport.start();
    });
    
    it('should receive newline-delimited JSON message', (done) => {
      const message = { jsonrpc: '2.0', method: 'test', params: { foo: 'bar' } };
      const payload = JSON.stringify(message) + '\n';
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
    
    it('should handle multiple newline-delimited messages', async () => {
      const messages: any[] = [];
      const message1 = { jsonrpc: '2.0', id: 1, method: 'test1' };
      const message2 = { jsonrpc: '2.0', id: 2, method: 'test2' };
      
      transport.onmessage = (msg) => {
        messages.push(msg);
      };
      
      mockStdin.write(JSON.stringify(message1) + '\n');
      mockStdin.write(JSON.stringify(message2) + '\n');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(message1);
      expect(messages[1]).toEqual(message2);
    });
    
    it('should ignore empty lines in newline-delimited mode', async () => {
      const messages: any[] = [];
      const message = { jsonrpc: '2.0', method: 'test' };
      
      transport.onmessage = (msg) => {
        messages.push(msg);
      };
      
      mockStdin.write('\n\n' + JSON.stringify(message) + '\n\n');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });
    
    it('should handle CRLF line endings in newline mode', (done) => {
      const message = { jsonrpc: '2.0', method: 'test' };
      const payload = JSON.stringify(message) + '\r\n';
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await transport.start();
    });
    
    it('should trigger onerror callback for invalid JSON in message body', (done) => {
      const invalidJson = 'Content-Length: 10\r\n\r\n{invalid}';
      
      transport.onerror = (err) => {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Failed to parse JSON-RPC message');
        done();
      };
      
      mockStdin.write(invalidJson);
    });
    
    it('should trigger onerror callback for invalid newline-delimited JSON', (done) => {
      const invalidJson = '{invalid json}\n';
      
      transport.onerror = (err) => {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Failed to parse JSON-RPC message');
        done();
      };
      
      mockStdin.write(invalidJson);
    });
    
    it('should handle stdin error events', (done) => {
      const testError = new Error('Stream error');
      
      transport.onerror = (err) => {
        expect(err).toBe(testError);
        done();
      };
      
      mockStdin.emit('error', testError);
    });
    
    it('should skip malformed Content-Length header and continue', async () => {
      const messages: any[] = [];
      
      // Malformed header followed by valid message
      const malformed = 'Content-Length: abc\r\n\r\n';
      const validMessage = { jsonrpc: '2.0', method: 'test' };
      const validJson = JSON.stringify(validMessage);
      const validPayload = `Content-Length: ${Buffer.byteLength(validJson, 'utf8')}\r\n\r\n${validJson}`;
      
      transport.onmessage = (msg) => {
        messages.push(msg);
      };
      
      mockStdin.write(malformed + validPayload);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(validMessage);
    });
    
    it('should not crash on data processing errors', async () => {
      const messages: any[] = [];
      let errors: any[] = [];
      
      transport.onmessage = (msg) => {
        messages.push(msg);
      };
      
      transport.onerror = (err) => {
        errors.push(err);
      };
      
      // Send some garbage data
      mockStdin.write(Buffer.from([0xFF, 0xFE, 0xFD]));
      
      // Then send valid message
      const validMessage = { jsonrpc: '2.0', method: 'test' };
      const validJson = JSON.stringify(validMessage);
      const validPayload = `Content-Length: ${Buffer.byteLength(validJson, 'utf8')}\r\n\r\n${validJson}`;
      
      await new Promise(resolve => setTimeout(resolve, 20));
      mockStdin.write(validPayload);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      // Should have received the valid message despite earlier errors
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Connection Lifecycle', () => {
    it('should handle start -> send -> receive -> close lifecycle', async () => {
      const receivedMessages: any[] = [];
      const sentMessages: any[] = [];
      let closeCalled = false;
      
      // Start
      await transport.start();
      
      // Set up handlers
      transport.onmessage = (msg) => {
        receivedMessages.push(msg);
      };
      
      transport.onclose = () => {
        closeCalled = true;
      };
      
      // Capture sent messages
      mockStdout.on('data', (chunk) => {
        const data = chunk.toString('utf8');
        if (data.includes('Content-Length:')) {
          const bodyStart = data.indexOf('\r\n\r\n') + 4;
          try {
            sentMessages.push(JSON.parse(data.slice(bodyStart)));
          } catch (e) {
            // Ignore parse errors for test
          }
        }
      });
      
      // Send a message
      const outgoingMessage = { jsonrpc: '2.0', method: 'initialize', params: {} };
      await transport.send(outgoingMessage);
      
      // Receive a message
      const incomingMessage = { jsonrpc: '2.0', id: 1, result: { initialized: true } };
      const json = JSON.stringify(incomingMessage);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      mockStdin.write(payload);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Close
      await transport.close();
      
      // Verify lifecycle
      expect(sentMessages.length).toBeGreaterThan(0);
      expect(receivedMessages).toContain(incomingMessage);
      expect(closeCalled).toBe(true);
    });
    
    it('should not accept messages after close', async () => {
      await transport.start();
      
      const receivedMessages: any[] = [];
      transport.onmessage = (msg) => {
        receivedMessages.push(msg);
      };
      
      await transport.close();
      
      // Try to send message after close
      const message = { jsonrpc: '2.0', method: 'test' };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      mockStdin.write(payload);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should not receive message after close
      expect(receivedMessages).toHaveLength(0);
    });
  });
  
  describe('Buffer Management', () => {
    beforeEach(async () => {
      await transport.start();
    });
    
    it('should handle large messages without buffer issues', (done) => {
      const largeData = 'x'.repeat(100000); // 100KB of data
      const message = { jsonrpc: '2.0', method: 'test', data: largeData };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
    
    it('should correctly accumulate partial messages in buffer', (done) => {
      const message = { jsonrpc: '2.0', method: 'test', params: { foo: 'bar' } };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      // Split into many small chunks
      const chunkSize = 5;
      let offset = 0;
      
      const sendNextChunk = () => {
        if (offset < payload.length) {
          const chunk = payload.slice(offset, offset + chunkSize);
          mockStdin.write(chunk);
          offset += chunkSize;
          setTimeout(sendNextChunk, 5);
        }
      };
      
      sendNextChunk();
    });
  });
  
  describe('Auto-Detection of Framing Mode', () => {
    beforeEach(async () => {
      await transport.start();
    });
    
    it('should detect Content-Length framing when header present', (done) => {
      const message = { jsonrpc: '2.0', method: 'test' };
      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
    
    it('should detect newline framing when message starts with brace', (done) => {
      const message = { jsonrpc: '2.0', method: 'test' };
      const payload = JSON.stringify(message) + '\n';
      
      transport.onmessage = (msg) => {
        expect(msg).toEqual(message);
        done();
      };
      
      mockStdin.write(payload);
    });
    
    it('should handle mixed framing modes in sequence', async () => {
      const messages: any[] = [];
      
      transport.onmessage = (msg) => {
        messages.push(msg);
      };
      
      // First: Content-Length
      const message1 = { jsonrpc: '2.0', id: 1, method: 'test1' };
      const json1 = JSON.stringify(message1);
      const payload1 = `Content-Length: ${Buffer.byteLength(json1, 'utf8')}\r\n\r\n${json1}`;
      
      // Second: Newline-delimited
      const message2 = { jsonrpc: '2.0', id: 2, method: 'test2' };
      const payload2 = JSON.stringify(message2) + '\n';
      
      mockStdin.write(payload1);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      mockStdin.write(payload2);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(message1);
      expect(messages[1]).toEqual(message2);
    });
  });
});
