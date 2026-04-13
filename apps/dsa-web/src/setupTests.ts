import '@testing-library/jest-dom';

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];

  disconnect() {}

  observe() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
});

// Radix UI (used by ShadCN components) requires ResizeObserver and PointerEvent
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Radix UI dismissable layer requires PointerEvent
if (!globalThis.PointerEvent) {
  class PointerEventMock extends MouseEvent {
    constructor(type: string, params?: PointerEventInit) {
      super(type, params);
    }
  }
  Object.defineProperty(globalThis, 'PointerEvent', {
    writable: true,
    value: PointerEventMock,
  });
}
