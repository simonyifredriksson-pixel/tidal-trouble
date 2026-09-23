/* Bus.js - a tiny event bus. Listener errors are logged, never swallowed
   silently, and nothing that STORES state is ever done inside a listener:
   callers award first and announce second. */

const map = new Map();

export const Bus = {
  on(name, fn) {
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(fn);
    return () => map.get(name)?.delete(fn);
  },
  emit(name, data) {
    const set = map.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); } catch (e) { console.error('[bus]', name, e); }
    }
  },
  clear() { map.clear(); },
};
