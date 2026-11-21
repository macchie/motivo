// Undo/redo over parameter snapshots. A seed + parameters fully define a
// track, so restoring a snapshot restores the music exactly.
export class History {
  constructor({ limit = 120, coalesceMs = 900 } = {}) {
    this.undoStack = []; this.redoStack = [];
    this.limit = limit; this.coalesceMs = coalesceMs;
    this._last = null; this.onChange = null;
  }
  // Call BEFORE mutating. Consecutive changes to the same control within
  // `coalesceMs` (e.g. one slider drag) become a single undo step.
  record(params, label, key = label) {
    const now = Date.now();
    if (this._last && this._last.key === key && now - this._last.at < this.coalesceMs) { this._last.at = now; return; }
    this.undoStack.push({ params: structuredClone(params), label });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this._last = { key, at: now };
    this.onChange && this.onChange();
  }
  // Ends coalescing so the next change starts a new step.
  seal() { this._last = null; }
  undo(current) {
    const s = this.undoStack.pop();
    if (!s) return null;
    this.redoStack.push({ params: structuredClone(current), label: s.label });
    this._last = null; this.onChange && this.onChange();
    return s;
  }
  redo(current) {
    const s = this.redoStack.pop();
    if (!s) return null;
    this.undoStack.push({ params: structuredClone(current), label: s.label });
    this._last = null; this.onChange && this.onChange();
    return s;
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
