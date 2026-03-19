import { EventEmitter } from "node:events";

export function createEventBus() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);

  return {
    publish(topic, payload) {
      emitter.emit(topic, payload);
    },
    subscribe(topic, handler) {
      emitter.on(topic, handler);
      return () => emitter.off(topic, handler);
    },
  };
}

