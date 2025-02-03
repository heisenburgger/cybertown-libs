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
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
}

export const TypedEventTarget = EventTarget as {
  new (): StateEventTarget;
  prototype: StateEventTarget;
};
