export class BoardRealtimeGate {
  private pending = false
  private busy: boolean
  private refresh: () => void
  constructor(busy: boolean, refresh: () => void) { this.busy = busy; this.refresh = refresh }
  notify() { if (this.busy) this.pending = true; else this.refresh() }
  setBusy(value: boolean) {
    this.busy = value
    if (!value && this.pending) { this.pending = false; this.refresh() }
  }
  clear() { this.pending = false }
}
