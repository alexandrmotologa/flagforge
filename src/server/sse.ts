import { Response } from 'express';

export interface SSEEvent {
  type: 'init' | 'flag_updated' | 'flag_deleted' | 'flag_toggled' | 'evaluation' | 'audit' | 'ping';
  data: unknown;
}

export class SSEManager {
  private clients: Set<Response> = new Set();
  private pingInterval?: NodeJS.Timeout;

  constructor() {
    this.startHeartbeat();
  }

  public addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write('retry: 3000\n\n');
    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  public broadcast(event: SSEEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      this.broadcast({ type: 'ping', data: { timestamp: new Date().toISOString() } });
    }, 15000);
  }

  public close(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
