/* eslint-disable @typescript-eslint/no-namespace */
export namespace Signal {
  class WithDataClass<T> implements WithData<T> {
    private listeners: Listener<T>[] = [];
    private listenersOnce: Listener<T>[] = [];

    listen = (listener: Listener<T>) => {
      this.listeners.push(listener);

      return {stopListen: () => this.stopListen(listener)};
    };

    listenOnce = (listener: Listener<T>) => {
      this.listenersOnce.push(listener);

      return {stopListenOnce: () => this.stopListenOnce(listener)};
    };

    stopListen = (listener: Listener<T>) => {
      const index = this.listeners.indexOf(listener, 0);
      if (index > -1) {
        this.listeners.splice(index, 1);

        return true;
      }

      return false;
    };

    stopListenOnce = (listener: Listener<T>) => {
      const index = this.listenersOnce.indexOf(listener, 0);
      if (index > -1) {
        this.listenersOnce.splice(index, 1);

        return true;
      }

      return false;
    };

    // concealed
    stopListenAll = () => {
      this.listeners = [];
      this.listenersOnce = [];
    };

    // concealed
    send = (data: T) => {
      this.listeners.forEach((listener) => listener(data));
      this.listenersOnce.forEach((listener) => listener(data));
      this.listenersOnce = [];
    };
  }

  class EmptyClass implements Empty {
    private listeners: ListenerEmpty[] = [];
    private listenersOnce: ListenerEmpty[] = [];

    listen = (listener: ListenerEmpty) => {
      this.listeners.push(listener);

      return {stopListen: () => this.stopListen(listener)};
    };

    listenOnce = (listener: ListenerEmpty) => {
      this.listenersOnce.push(listener);

      return {stopListenOnce: () => this.stopListenOnce(listener)};
    };

    stopListen = (listener: ListenerEmpty) => {
      const index = this.listeners.indexOf(listener, 0);
      if (index > -1) {
        this.listeners.splice(index, 1);

        return true;
      }

      return false;
    };

    stopListenOnce = (listener: ListenerEmpty) => {
      const index = this.listenersOnce.indexOf(listener, 0);
      if (index > -1) {
        this.listenersOnce.splice(index, 1);

        return true;
      }

      return false;
    };

    // concealed
    stopListenAll = () => {
      this.listeners = [];
      this.listenersOnce = [];
    };

    // concealed
    send = () => {
      this.listeners.forEach((listener) => listener());
      this.listenersOnce.forEach((listener) => listener());
      this.listenersOnce = [];
    };
  }

  type Listener<T> = (data: T) => void;
  type ListenerEmpty = () => void;

  export type Send<T> = (data: T) => void;
  export type SendEmpty = () => void;

  export interface WithData<T> {
    listen: (listener: Listener<T>) => {stopListen: () => boolean};
    listenOnce: (listener: Listener<T>) => {stopListenOnce: () => boolean};
    stopListen: (listener: Listener<T>) => boolean;
    stopListenOnce: (listener: Listener<T>) => boolean;
  }

  export interface Empty {
    listen: (listener: ListenerEmpty) => {stopListen: () => boolean};
    listenOnce: (listener: ListenerEmpty) => {stopListenOnce: () => boolean};
    stopListen: (listener: ListenerEmpty) => boolean;
    stopListenOnce: (listener: ListenerEmpty) => boolean;
  }

  type Return<T> = {signal: WithData<T>; send: (data: T) => void; stopListenAll: () => void};
  type ReturnEmpty = {signal: Empty; send: () => void; stopListenAll: () => void};

  class Create {
    withData<T>(): Return<T> {
      const signal = new WithDataClass<T>();

      return {
        signal,
        send: signal.send,
        stopListenAll: signal.stopListenAll,
      };
    }

    empty(): ReturnEmpty {
      const signal = new EmptyClass();

      return {
        signal,
        send: signal.send,
        stopListenAll: signal.stopListenAll,
      };
    }
  }

  export const create = new Create();
}
