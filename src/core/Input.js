/* Input.js - keyboard, mouse and pointer lock.
   `blocked` is the single switch a menu flips to freeze all game input; the
   game never reads raw DOM events itself. Edge-triggered queries (`pressed`,
   `released`, `clicked`) are cleared at the end of every frame by `endFrame`.
   Keys are stored by KeyboardEvent.code so WASD works on any layout. */

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.down = new Set();     // pressed this frame
    this.up = new Set();       // released this frame
    this.mouse = { dx: 0, dy: 0, wheel: 0, buttons: new Set(), clicked: new Set(), released: new Set(), x: 0, y: 0 };
    this.blocked = false;
    this.locked = false;
    this.wantLock = true;
    this.sensitivity = 1;
    this.invertY = false;
    this.onLockChange = null;

    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (isTyping(e)) return;
      this.keys.add(e.code);
      this.down.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code) && !this.blocked) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', e => {
      this.keys.delete(e.code);
      this.up.add(e.code);
    });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons.clear(); });

    el.addEventListener('mousedown', e => {
      // the click that captures the mouse is not also a cast
      if (!this.locked && this.wantLock && !this.blocked) { this.lock(); if (this.requireLock) return; }
      this.mouse.buttons.add(e.button);
      this.mouse.clicked.add(e.button);
    });
    addEventListener('mouseup', e => {
      this.mouse.buttons.delete(e.button);
      this.mouse.released.add(e.button);
    });
    addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.locked) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; }
    });
    el.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    el.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    try {
      const p = this.el.requestPointerLock && this.el.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* refused - fine */ }
  }
  unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } }

  held(code) { return !this.blocked && this.keys.has(code); }
  pressed(code) { return !this.blocked && this.down.has(code); }
  released(code) { return this.up.has(code); }
  /** raw, ignoring `blocked` - for menu toggles */
  pressedRaw(code) { return this.down.has(code); }
  btn(b) { return !this.blocked && this.mouse.buttons.has(b); }
  click(b) { return !this.blocked && this.mouse.clicked.has(b); }
  unclick(b) { return this.mouse.released.has(b); }

  axis(neg, pos) { return (this.held(pos) ? 1 : 0) - (this.held(neg) ? 1 : 0); }

  look() {
    if (this.blocked) return { x: 0, y: 0 };
    const s = 0.0022 * this.sensitivity;
    return { x: this.mouse.dx * s, y: this.mouse.dy * s * (this.invertY ? -1 : 1) };
  }

  endFrame() {
    this.down.clear(); this.up.clear();
    this.mouse.clicked.clear(); this.mouse.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
  }

  /** Simulate input from a test / autopilot. */
  fake(code, on) { if (on) { this.keys.add(code); this.down.add(code); } else { this.keys.delete(code); this.up.add(code); } }
  fakeBtn(b, on) { if (on) { this.mouse.buttons.add(b); this.mouse.clicked.add(b); } else { this.mouse.buttons.delete(b); this.mouse.released.add(b); } }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
