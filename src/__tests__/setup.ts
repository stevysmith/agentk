import '@testing-library/jest-dom/vitest'

// Polyfill ResizeObserver for jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom ships no PointerEvent, so a fired pointer event reaches React without
// `pointerType` — which is exactly the field the touch guards read.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerType: string
    pointerId: number
    constructor(type: string, params: any = {}) {
      super(type, params)
      this.pointerType = params.pointerType ?? ''
      this.pointerId = params.pointerId ?? 0
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as any
}

// Polyfill Element.scrollIntoView for jsdom
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = function () {}
}

// Override requestAnimationFrame to return a mutable object wrapper
// so that (raf as any).__timer = timer works in the source code
const _origRAF = globalThis.requestAnimationFrame
const _origCAF = globalThis.cancelAnimationFrame

const rafMap = new Map<number, any>()

globalThis.requestAnimationFrame = function (cb: FrameRequestCallback): any {
  const id = _origRAF(cb)
  // Wrap in a mutable object so __timer can be set on it
  const wrapper: any = Object.create(null)
  wrapper.__id = id
  wrapper.valueOf = () => id
  rafMap.set(id, wrapper)
  return wrapper
}

globalThis.cancelAnimationFrame = function (handle: any): void {
  const id = typeof handle === 'number' ? handle : handle?.__id ?? handle
  _origCAF(id)
  rafMap.delete(id)
}
