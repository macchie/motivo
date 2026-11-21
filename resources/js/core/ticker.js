// A steady tick for the audio scheduler. Timers inside a worker are not
// throttled like main-thread timers when the window is hidden or minimised.
const SRC = 'let t=null;onmessage=(e)=>{clearInterval(t);t=null;if(e.data>0)t=setInterval(()=>postMessage(0),e.data);};';
let url = null;

export class Ticker {
  constructor(fn, ms) {
    this.fn = fn; this.ms = ms; this.worker = null; this.timer = null;
    try {
      url = url || URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = () => this.fn();
      this.worker.onerror = () => { this.worker = null; if (this.running) this._interval(); };
    } catch (e) {
      this.worker = null;
    }
  }
  _interval() { clearInterval(this.timer); this.timer = setInterval(this.fn, this.ms); }
  start() {
    this.running = true;
    if (this.worker) this.worker.postMessage(this.ms); else this._interval();
  }
  stop() {
    this.running = false;
    if (this.worker) this.worker.postMessage(0);
    clearInterval(this.timer); this.timer = null;
  }
}
