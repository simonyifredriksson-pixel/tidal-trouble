/* Chat.js - text chat. Tap CTRL to open it, type, ENTER to send, ESC to
   back out. Lines sit in the bottom-left as `<name> message`, newest at the
   bottom, and fade out on their own a few seconds after they arrive.

   CTRL, but only a TAP. The chat opens when Ctrl is released without any
   other key having been pressed while it was down - so Ctrl+C, Ctrl+V,
   Ctrl+R and every other browser shortcut are left alone.

   The same line again does not add a row: it gets a count, `hello (3)`.
   Every message comes off the network from another player, so nothing here
   ever touches innerHTML - names and bodies are written with textContent.

   A line that could not be sent (no crew, or the connection dropped) is
   marked NOT SENT right on itself, because the sender is the only person who
   can be told nobody got it. */

const FADE_AFTER = 9.5;
const MAX_LINES = 120;
const SHOW_SHUT = 6;
const SHOW_OPEN = 14;
const MAX_LEN = 120;
const DUPE_ROWS = 8;
const DUPE_AGE = 60;
const now = () => performance.now() / 1000;

export class Chat {
  /**
   * @param opts.input    the game's Input - blocked while typing
   * @param opts.onSend   (text) => null | reason-string
   * @param opts.canOpen  () => boolean
   * @param opts.selfName () => string
   * @param opts.selfColor () => css colour
   * @param opts.onClose  () => void
   */
  constructor(opts = {}) {
    this.input = opts.input;
    this.onSend = opts.onSend || (() => null);
    this.canOpen = opts.canOpen || (() => true);
    this.selfName = opts.selfName || (() => 'Fisher');
    this.selfColor = opts.selfColor || (() => '#ffd27a');
    this.onClose = opts.onClose || (() => {});
    this.open = false;
    this.lines = [];
    this.history = []; this._histAt = -1;
    this._fadeTimer = null;
    this._ctrlDown = false; this._ctrlClean = false;
    this.closedAt = -10;
    this._build();
    this._bind();
  }

  _build() {
    const root = document.createElement('div');
    root.id = 'chat';
    root.innerHTML = `<div id="chat-log"></div>
      <form id="chat-entry" autocomplete="off"><span class="chat-caret">&gt;</span>
        <input id="chat-field" type="text" maxlength="${MAX_LEN}" spellcheck="false" placeholder="Say something to your crew...">
        <span class="chat-hint"><kbd>ENTER</kbd> SEND <kbd>ESC</kbd> CANCEL</span></form>`;
    document.body.appendChild(root);
    this.root = root;
    this.logEl = root.querySelector('#chat-log');
    this.formEl = root.querySelector('#chat-entry');
    this.fieldEl = root.querySelector('#chat-field');
  }

  _bind() {
    document.addEventListener('keydown', e => {
      const ctrl = e.code === 'ControlLeft' || e.code === 'ControlRight';
      if (!this.open) {
        if (ctrl) { if (!e.repeat) { this._ctrlDown = true; this._ctrlClean = true; } return; }
        // any other key while Ctrl is held makes it a shortcut, not a chat tap
        if (this._ctrlDown) this._ctrlClean = false;
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); this.close(); return; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.submit(); return; }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); this._recall(e.code === 'ArrowUp' ? 1 : -1); }
    });
    document.addEventListener('keyup', e => {
      if (e.code !== 'ControlLeft' && e.code !== 'ControlRight') return;
      const tap = this._ctrlDown && this._ctrlClean;
      this._ctrlDown = false;
      if (tap && !this.open) this.tryOpen();
    });
    addEventListener('mousedown', () => { if (this._ctrlDown) this._ctrlClean = false; });
    addEventListener('blur', () => { this._ctrlDown = false; });
    this.formEl.addEventListener('submit', e => { e.preventDefault(); this.submit(); });
  }

  tryOpen() {
    if (this.open || !this.canOpen()) return false;
    this.open = true;
    this.root.classList.add('open');
    if (this.input) { this.input.keys.clear(); this.input.mouse.buttons.clear(); this.input.blocked = true; }
    this._histAt = -1;
    this.fieldEl.value = '';
    this.fieldEl.focus();
    this._render();
    return true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.closedAt = now();
    this.root.classList.remove('open');
    this.fieldEl.value = ''; this.fieldEl.blur();
    this._render();
    this._armFade();
    this.onClose();
  }
  forceClose() { this.close(); }

  submit() {
    const text = String(this.fieldEl.value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    if (text) {
      this.history.push(text);
      if (this.history.length > 40) this.history.shift();
      const line = this.push({ name: this.selfName(), text, color: this.selfColor(), self: true });
      let why = null;
      try { const r = this.onSend(text); why = typeof r === 'string' && r ? r : null; } catch (e) { why = 'That did not send - the connection errored.'; }
      if (why) { if (line) line.undelivered = true; this.system(why); }
    }
    this.close();
  }

  _recall(dir) {
    if (!this.history.length) return;
    this._histAt = Math.max(-1, Math.min(this.history.length - 1, this._histAt + dir));
    this.fieldEl.value = this._histAt < 0 ? '' : this.history[this.history.length - 1 - this._histAt];
    const n = this.fieldEl.value.length;
    this.fieldEl.setSelectionRange(n, n);
  }

  push(line) {
    if (!line) return null;
    const text = String(line.text == null ? '' : line.text).slice(0, MAX_LEN);
    if (!text) return null;
    const name = line.system ? '' : String(line.name || 'Fisher').slice(0, 16);
    const t = now(), key = name + ' ' + text;
    for (let i = this.lines.length - 1; i >= Math.max(0, this.lines.length - DUPE_ROWS); i--) {
      const l = this.lines[i];
      if (l.key !== key || t - l.first > DUPE_AGE) continue;
      l.count++; l.t = t; l.undelivered = false;
      this._render(); this._armFade();
      return l;
    }
    const row = { name, text, key, count: 1, t, first: t, color: line.color || '#e8e0c8', self: !!line.self, system: !!line.system, radio: !!line.radio, undelivered: false };
    this.lines.push(row);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this._render(); this._armFade();
    return row;
  }
  system(text) { return this.push({ text, system: true }); }

  _render() {
    const shown = this.lines.slice(-(this.open ? SHOW_OPEN : SHOW_SHUT));
    const t = now();
    this.logEl.textContent = '';
    for (const l of shown) {
      const row = document.createElement('div');
      row.className = 'chat-line' + (l.system ? ' system' : '') + (l.self ? ' self' : '') + (l.undelivered ? ' undelivered' : '');
      if (!this.open && t - l.t > FADE_AFTER) row.classList.add('gone');
      if (l.name) {
        const who = document.createElement('span');
        who.className = 'chat-who';
        who.style.color = l.color;
        who.textContent = `<${l.name}>`;
        row.appendChild(who);
      }
      const body = document.createElement('span');
      body.className = 'chat-text';
      body.textContent = l.text;
      row.appendChild(body);
      if (l.count > 1) { const n = document.createElement('span'); n.className = 'chat-count'; n.textContent = `(${l.count})`; row.appendChild(n); }
      if (l.undelivered) { const x = document.createElement('span'); x.className = 'chat-fail'; x.textContent = 'NOT SENT'; row.appendChild(x); }
      this.logEl.appendChild(row);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  _armFade() {
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this.open) return;
    const t = now();
    let soonest = Infinity;
    for (const l of this.lines.slice(-SHOW_SHUT)) { const left = FADE_AFTER - (t - l.t); if (left > 0 && left < soonest) soonest = left; }
    if (soonest === Infinity) return;
    this._fadeTimer = setTimeout(() => { this._fadeTimer = null; this._render(); this._armFade(); }, soonest * 1000 + 60);
  }
}
