import { ConnectTransport, ProduceTransport } from "./types";

interface StateEventMap {
  connect: CustomEvent<ConnectTransport>;
  produce: CustomEvent<ProduceTransport>;
}

interface StateEventTarget extends EventTarget {
  addEventListener<K extends keyof StateEventMap>(
    type: K,
    listener: (ev: StateEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export class TypedEventTarget extends EventTarget implements StateEventTarget {
  addEventListener<K extends keyof StateEventMap>(
    type: K | string,
    listener:
      | ((ev: StateEventMap[K]) => void)
      | EventListenerOrEventListenerObject
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type as string, listener as EventListener, options);
  }
}
