export class EventBus extends EventTarget {
  private static instance: EventBus;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }

    return EventBus.instance;
  }

  public emit(event: string, detail?: any): void {
    this.dispatchEvent(new CustomEvent(event, {detail}));
  }

  public on(event: string, listener: (event: CustomEvent) => void): void {
    this.addEventListener(event, listener as EventListener);
  }

  public off(event: string, listener: (event: CustomEvent) => void): void {
    this.removeEventListener(event, listener as EventListener);
  }
}
