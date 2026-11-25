type Handler<T = unknown> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on<T = unknown>(event: string, handler: Handler<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as Handler);
    return () => this.off(event, handler as Handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit<T = unknown>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload as T);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const bus = new EventBus();
