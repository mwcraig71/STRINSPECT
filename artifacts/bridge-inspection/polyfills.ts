if (typeof Promise.withResolvers === "undefined") {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// React Native polyfills structuredClone via @ungap/structured-clone, whose
// serialize() does `(value, {json, lossy} = {}) =>`.  The default `= {}` only
// applies when the second arg is `undefined`, NOT `null`.  pdf.js's
// LoopbackPort calls `structuredClone(obj, null)` when there are no
// transferables, which crashes the @ungap polyfill.  Wrap the global so null
// is silently converted to undefined.
const _sc = (globalThis as Record<string, unknown>).structuredClone as
  | ((v: unknown, opts?: unknown) => unknown)
  | undefined;
if (typeof _sc === "function") {
  (globalThis as Record<string, unknown>).structuredClone = function (
    value: unknown,
    options?: unknown,
  ) {
    return _sc(value, options == null ? undefined : options);
  };
}
