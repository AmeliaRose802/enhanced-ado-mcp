import process from "node:process";

// Minimal transport interface expected by @modelcontextprotocol/sdk Server
export class HybridStdioServerTransport {
  private _stdin: NodeJS.ReadStream;
  private _stdout: NodeJS.WriteStream;
  private _started = false;
  private _buffer: Buffer = Buffer.alloc(0);

  onmessage?: (msg: any) => void;
  onerror?: (err: any) => void;
  onclose?: () => void;

  constructor(_stdin = process.stdin, _stdout = process.stdout) {
    this._stdin = _stdin;
    this._stdout = _stdout;
  }

  async start() {
    if (this._started) throw new Error("HybridStdioServerTransport already started");
    this._started = true;
    this._stdin.on("data", this._onData);
    this._stdin.on("error", (e) => this.onerror?.(e));
  }

  async close() {
    this._stdin.off("data", this._onData);
    this.onclose?.();
  }

  send(message: any) {
    return new Promise<void>((resolve) => {
      const json = JSON.stringify(message);
      const framingMode =
        process.env.MCP_FORCE_CONTENT_LENGTH === "1"
          ? "cl"
          : process.env.MCP_FORCE_NEWLINE === "1"
            ? "nl"
            : "auto";
      let payload: string;
      if (framingMode === "cl") {
        payload = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
      } else if (framingMode === "nl") {
        payload = json + "\n";
      } else {
        // auto: prefer Content-Length for maximum compatibility
        payload = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
      }
      if (this._stdout.write(payload)) resolve();
      else this._stdout.once("drain", resolve);
    });
  }

  private _onData = (chunk: Buffer) => {
    try {
      this._buffer = Buffer.concat([this._buffer, chunk]);
      // Try parse Content-Length frames first
      while (true) {
        if (this._buffer.length === 0) return;
        const headerEnd = this._buffer.indexOf("\r\n\r\n");
        const firstNewline = this._buffer.indexOf("\n");
        const startsWithBrace = this._buffer[0] === 0x7b; // '{'
        const startsWithContentLength = this._buffer
          .toString("utf8", 0, 15)
          .toLowerCase()
          .startsWith("content-length");

        if (startsWithContentLength && headerEnd !== -1) {
          const header = this._buffer.toString("utf8", 0, headerEnd);
          const match = /Content-Length:\s*(\d+)/i.exec(header);
          if (!match) {
            // Malformed header: drop line and continue
            this._buffer = this._buffer.subarray(headerEnd + 4);
            continue;
          }
          const length = parseInt(match[1], 10);
          const totalLen = headerEnd + 4 + length;
          if (this._buffer.length < totalLen) {
            // Wait for more data
            return;
          }
          const body = this._buffer.toString("utf8", headerEnd + 4, totalLen);
          this._buffer = this._buffer.subarray(totalLen);
          this._emitMessage(body);
          continue; // loop for more
        } else if (!startsWithContentLength && startsWithBrace && firstNewline !== -1) {
          // Newline-delimited JSON
          const line = this._buffer.toString("utf8", 0, firstNewline).trimEnd();
          this._buffer = this._buffer.subarray(firstNewline + 1);
          if (line.length > 0) this._emitMessage(line);
          continue;
        }
        // Need more data
        return;
      }
    } catch (err) {
      this.onerror?.(err);
    }
  };

  private _emitMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);
      this.onmessage?.(msg);
    } catch (err) {
      this.onerror?.(new Error(`Failed to parse JSON-RPC message: ${err}`));
    }
  }
}
