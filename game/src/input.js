// Emberward — keyboard and mouse input.
// Tracks held keys, one-frame "just pressed" edges, and the mouse position
// in canvas coordinates (the canvas is scaled by CSS, so client coordinates
// are mapped through its bounding box). Movement keys are read as a vector
// by the world; UI keys are consumed as edges by the state machine.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;
    this.mousePressed = false;
    this.anyGesture = false;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
      this.anyGesture = true;
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (event) => {
      event.preventDefault();
      if (event.button === 0) {
        if (!this.mouseDown) this.mousePressed = true;
        this.mouseDown = true;
        this.anyGesture = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Movement vector from WASD or arrow keys, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  dashPressed() {
    return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight');
  }

  // True once, on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  wasMousePressed() {
    return this.mousePressed;
  }

  // Clear all one-frame edges. Called at the end of each rendered frame.
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
  }
}
