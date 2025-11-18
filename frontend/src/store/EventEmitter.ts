// Simple EventEmitter implementation for browser environment
type EventListener = (...args: unknown[]) => void;

export default class EventEmitter {
  private listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  once(event: string, listener: EventListener): this {
    const onceWrapper: EventListener = (...args: unknown[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.listeners.get(event);
    if (listeners && listeners.length > 0) {
      listeners.forEach((listener) => {
        listener(...args);
      });
      return true;
    }
    return false;
  }

  removeListener(event: string, listener: EventListener): this {
    return this.off(event, listener);
  }

  addListener(event: string, listener: EventListener): this {
    return this.on(event, listener);
  }
}
