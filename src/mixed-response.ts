type PartHeaders = Record<string, string>;

interface PartContent {
  data: string | Buffer | ReadableStream;
  length?: number; // Optional for streams
}

interface Part {
  content: PartContent;
  contentType: string;
  headers?: PartHeaders;
}

export class MultipartResponse {
  private parts: Part[] = [];
  boundary: string;
  boundaryPrefix = "--";
  quotedBoundary: boolean;

  constructor(options: { quotedBoundary?: boolean } = {}) {
    this.boundary = `boundary-${crypto.randomUUID()}`;
    this.quotedBoundary = options.quotedBoundary || false;
  }

  addFile(
    content: string | Buffer | ReadableStream,
    contentType: string,
    options?: {
      headers?: PartHeaders;
      contentLength?: number;
    }
  ): this {
    this.parts.push({
      content: { data: content, length: options?.contentLength },
      contentType,
      headers: options?.headers,
    });
    return this;
  }

  addText(content: string, options?: { headers?: PartHeaders }): this {
    this.parts.push({
      content: {
        data: content,
        length: Buffer.from(content).length,
      },
      contentType: "text/plain",
      headers: options?.headers,
    });
    return this;
  }

  addJSON(content: any, options?: { headers?: PartHeaders }): this {
    const jsonString = JSON.stringify(content);
    this.parts.push({
      content: {
        data: jsonString,
        length: Buffer.from(jsonString).length,
      },
      contentType: "application/json",
      headers: options?.headers,
    });
    return this;
  }

  private createPartHeader(part: Part): string {
    const lines: string[] = [];

    lines.push(`${this.boundaryPrefix}${this.boundary}`);

    if (part.content.length) {
      lines.push(`Content-Length: ${part.content.length}`);
    }

    if (part.headers) {
      for (const [key, value] of Object.entries(part.headers)) {
        lines.push(`${key}: ${value}`);
      }
    }

    lines.push(`Content-Type: ${part.contentType}`);

    lines.push(""); // Empty line before content
    return lines.join("\r\n");
  }

  private async *generateStream(): AsyncGenerator<string | Uint8Array> {
    for (const part of this.parts) {
      yield this.createPartHeader(part);
      yield "\r\n";

      if (part.content.data instanceof ReadableStream) {
        const reader = part.content.data.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } else {
        yield part.content.data;
      }
      yield "\r\n";
    }

    yield `${this.boundaryPrefix}${this.boundary}--\r\n`;
  }

  toStream(): ReadableStream {
    const self = this; // Capture 'this' context
    return new ReadableStream({
      async start(controller) {
        for await (const chunk of self.generateStream()) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  }

  toBuffer(): Buffer {
    const hasStreams = this.parts.some(
      (part) => part.content.data instanceof ReadableStream
    );

    if (hasStreams) {
      throw new Error(
        "Cannot convert multipart response with streams to buffer"
      );
    }

    const parts = this.parts.map((part) => {
      return [this.createPartHeader(part), part.content.data].join("\r\n");
    });

    parts.push(`${this.boundaryPrefix}${this.boundary}--`);

    parts.push(""); // Add final CRLF

    return Buffer.from(parts.join("\r\n"));
  }

  headers() {
    const boundary = this.quotedBoundary ? `"${this.boundary}"` : this.boundary;
    return {
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    };
  }

  toResponse(headers: Record<string, string> = {}): Response {
    const hasStreams = this.parts.some(
      (part) => part.content.data instanceof ReadableStream
    );

    if (hasStreams) {
      return new Response(this.toStream(), {
        headers: {
          ...headers,
          ...this.headers(),
        },
      });
    }

    const buffer = this.toBuffer();

    return new Response(buffer, {
      headers: {
        ...headers,
        ...this.headers(),
        // "Content-Length": (buffer.length + 2).toString(), // Add 2 for CRLF
      },
    });
  }
}
