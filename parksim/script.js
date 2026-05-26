const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class Car {
  constructor(x, y, heading) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
    this.wheelBase = 72;
    this.length = 118;
    this.width = 52;
    this.maxSteer = 35 * DEG;
    this.rearToHitch = 18;
  }

  getFrontAxle() {
    return {
      x: this.x + Math.cos(this.heading) * this.wheelBase * 0.5,
      y: this.y + Math.sin(this.heading) * this.wheelBase * 0.5,
    };
  }

  getRearAxle() {
    return {
      x: this.x - Math.cos(this.heading) * this.wheelBase * 0.5,
      y: this.y - Math.sin(this.heading) * this.wheelBase * 0.5,
    };
  }

  getHitchPoint() {
    const rear = this.getRearAxle();
    return {
      x: rear.x - Math.cos(this.heading) * this.rearToHitch,
      y: rear.y - Math.sin(this.heading) * this.rearToHitch,
    };
  }

  update(dt, input) {
    const accel = 130;
    const maxFwd = 90;
    const maxRev = -65;
    const drag = 2.2;

    if (input.forward) this.speed += accel * dt;
    if (input.backward) this.speed -= accel * dt;
    if (!input.forward && !input.backward) {
      this.speed *= Math.exp(-drag * dt);
      if (Math.abs(this.speed) < 0.02) this.speed = 0;
    }

    this.speed = clamp(this.speed, maxRev, maxFwd);

    const steerAngle = input.getSteeringAngle(this.maxSteer);
    const yawRate = (this.speed / this.wheelBase) * Math.tan(steerAngle);
    this.heading = wrapAngle(this.heading + yawRate * dt);

    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;

    return { steerAngle };
  }

  draw(ctx, steerAngle) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);

    ctx.fillStyle = '#3f8dde';
    ctx.strokeStyle = '#0b1a2b';
    ctx.lineWidth = 2;
    ctx.fillRect(-this.length / 2, -this.width / 2, this.length, this.width);
    ctx.strokeRect(-this.length / 2, -this.width / 2, this.length, this.width);

    ctx.fillStyle = '#76b5ff';
    ctx.fillRect(4, -this.width / 2 + 4, this.length / 2 - 8, this.width - 8);

    const wheelW = 8;
    const wheelL = 22;
    const axFrontX = this.wheelBase * 0.5;
    const axRearX = -this.wheelBase * 0.5;
    const yOff = this.width * 0.5 + 1;

    const drawWheel = (x, y, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = '#111';
      ctx.fillRect(-wheelL / 2, -wheelW / 2, wheelL, wheelW);
      ctx.restore();
    };

    drawWheel(axRearX, -yOff, 0);
    drawWheel(axRearX, yOff, 0);
    drawWheel(axFrontX, -yOff, steerAngle);
    drawWheel(axFrontX, yOff, steerAngle);

    ctx.restore();
  }
}

class Trailer {
  constructor(lengthToAxle, bodyLength, width) {
    this.lengthToAxle = lengthToAxle;
    this.bodyLength = bodyLength;
    this.width = width;
    this.heading = 0;
    this.axleX = 0;
    this.axleY = 0;
    this.maxArticulation = 85 * DEG;
    this.hitLimit = false;
    this.trace = [];
  }

  attachInitial(car) {
    const hitch = car.getHitchPoint();
    this.heading = car.heading;
    this.axleX = hitch.x - Math.cos(this.heading) * this.lengthToAxle;
    this.axleY = hitch.y - Math.sin(this.heading) * this.lengthToAxle;
    this.trace = [{ x: this.axleX, y: this.axleY }];
  }

  update(dt, car) {
    const hitch = car.getHitchPoint();

    // Relativní úhel mezi osou auta a vozíku.
    let articulation = wrapAngle(car.heading - this.heading);

    // Jednoduchý model natáčení vozíku kolem nápravy:
    // d(theta_trailer)/dt = (v / L_trailer) * sin(articulation)
    this.heading += (car.speed / this.lengthToAxle) * Math.sin(articulation) * dt;
    this.heading = wrapAngle(this.heading);

    articulation = wrapAngle(car.heading - this.heading);
    this.hitLimit = false;
    if (articulation > this.maxArticulation) {
      articulation = this.maxArticulation;
      this.heading = wrapAngle(car.heading - articulation);
      this.hitLimit = true;
    } else if (articulation < -this.maxArticulation) {
      articulation = -this.maxArticulation;
      this.heading = wrapAngle(car.heading - articulation);
      this.hitLimit = true;
    }

    // Geometrické ukotvení: náprava vozíku je za závěsem o délku oje.
    this.axleX = hitch.x - Math.cos(this.heading) * this.lengthToAxle;
    this.axleY = hitch.y - Math.sin(this.heading) * this.lengthToAxle;

    if (!this.trace.length || Math.hypot(this.axleX - this.trace[this.trace.length - 1].x, this.axleY - this.trace[this.trace.length - 1].y) > 2) {
      this.trace.push({ x: this.axleX, y: this.axleY });
      if (this.trace.length > 1200) this.trace.shift();
    }

    return { articulation };
  }

  resetTrace() { this.trace = [{ x: this.axleX, y: this.axleY }]; }

  draw(ctx, car) {
    const hitch = car.getHitchPoint();

    ctx.save();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.trace.length; i++) {
      const p = this.trace[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#d3c18b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hitch.x, hitch.y);
    ctx.lineTo(this.axleX, this.axleY);
    ctx.stroke();
    ctx.restore();

    const centerX = this.axleX + Math.cos(this.heading) * (this.bodyLength * 0.45);
    const centerY = this.axleY + Math.sin(this.heading) * (this.bodyLength * 0.45);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.heading);
    ctx.fillStyle = '#c8a765';
    ctx.strokeStyle = '#5f4b27';
    ctx.lineWidth = 2;
    ctx.fillRect(-this.bodyLength / 2, -this.width / 2, this.bodyLength, this.width);
    ctx.strokeRect(-this.bodyLength / 2, -this.width / 2, this.bodyLength, this.width);

    ctx.fillStyle = '#111';
    ctx.fillRect(-10, -this.width / 2 - 3, 20, 7);
    ctx.fillRect(-10, this.width / 2 - 4, 20, 7);
    ctx.restore();
  }
}

class ParkingLot {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.bounds = { x: 60, y: 60, w: w - 120, h: h - 120 };
    this.gate = { x1: 60, y1: h / 2 - 55, x2: 60, y2: h / 2 + 55 };
    this.obstacles = [
      { x: 165, y: 95, w: 770, h: 22 },
      { x: 165, y: h - 117, w: 770, h: 22 },
      { x: w - 172, y: 170, w: 22, h: h - 340 },
    ];
  }

  draw(ctx) {
    ctx.fillStyle = '#2b3036';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke(); }
    for (let y = 0; y < this.h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }

    ctx.fillStyle = '#3a414a';
    ctx.fillRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);

    ctx.strokeStyle = '#e7edf7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.bounds.x, this.bounds.y);
    ctx.lineTo(this.bounds.x + this.bounds.w, this.bounds.y);
    ctx.lineTo(this.bounds.x + this.bounds.w, this.bounds.y + this.bounds.h);
    ctx.lineTo(this.bounds.x, this.bounds.y + this.bounds.h);
    ctx.moveTo(this.bounds.x, this.bounds.y);
    ctx.lineTo(this.bounds.x, this.gate.y1);
    ctx.moveTo(this.bounds.x, this.gate.y2);
    ctx.lineTo(this.bounds.x, this.bounds.y + this.bounds.h);
    ctx.stroke();

    ctx.fillStyle = '#9ec4ff';
    ctx.fillRect(this.bounds.x - 10, this.gate.y1 - 10, 10, 10);
    ctx.fillRect(this.bounds.x - 10, this.gate.y2, 10, 10);

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 170 + i * 75;
      ctx.strokeRect(230, y, 125, 58);
      ctx.strokeRect(390, y, 125, 58);
    }

    ctx.fillStyle = '#696969';
    for (const o of this.obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  isCollision(car) {
    const margin = 18;
    const minX = this.bounds.x - 100;
    const maxX = this.bounds.x + this.bounds.w;
    const minY = this.bounds.y;
    const maxY = this.bounds.y + this.bounds.h;
    if (car.x < minX + margin || car.x > maxX - margin || car.y < minY + margin || car.y > maxY - margin) {
      // U levé strany povol průjezd bránou.
      const inGate = car.y > this.gate.y1 + 8 && car.y < this.gate.y2 - 8;
      if (!(car.x < this.bounds.x + margin && inGate)) return true;
    }
    return this.obstacles.some(o => car.x > o.x - margin && car.x < o.x + o.w + margin && car.y > o.y - margin && car.y < o.y + o.h + margin);
  }
}

class InputController {
  constructor(wheelEl) {
    this.forward = false;
    this.backward = false;
    this.wheelDeg = 0;
    this.maxWheelDeg = 540;
    this.dragging = false;
    this.lastMouseAngle = 0;
    this.wheelEl = wheelEl;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));

    wheelEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastMouseAngle = this.pointerAngle(e);
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const cur = this.pointerAngle(e);
      let delta = (cur - this.lastMouseAngle) * RAD;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this.wheelDeg = clamp(this.wheelDeg + delta, -this.maxWheelDeg, this.maxWheelDeg);
      this.lastMouseAngle = cur;
    });

    window.addEventListener('mouseup', () => this.dragging = false);
    wheelEl.addEventListener('mouseleave', () => { if (!this.dragging) return; });
  }

  pointerAngle(e) {
    const rect = this.wheelEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === 'w') this.forward = down;
    if (k === 's') this.backward = down;
    if (e.code === 'Space' && down) {
      this.centerSteering();
      e.preventDefault();
    }
  }

  centerSteering() { this.wheelDeg = 0; }

  getSteeringAngle(maxSteerRad) {
    return (this.wheelDeg / this.maxWheelDeg) * maxSteerRad;
  }
}

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const speedVal = document.getElementById('speedVal');
const steerWheelVal = document.getElementById('steerWheelVal');
const frontWheelVal = document.getElementById('frontWheelVal');
const hitchVal = document.getElementById('hitchVal');
const warningEl = document.getElementById('jackknifeWarning');
const wheelEl = document.getElementById('steeringWheel');

const lot = new ParkingLot(canvas.width, canvas.height);
const input = new InputController(wheelEl);

let car;
let trailer;

function initState() {
  car = new Car(145, canvas.height / 2, 0);
  trailer = new Trailer(62, 74, 42);
  trailer.attachInitial(car);
  input.centerSteering();
  car.speed = 0;
}

function updateUI(steerAngle, articulation) {
  speedVal.textContent = `${car.speed.toFixed(2)} m/s`;
  steerWheelVal.textContent = `${input.wheelDeg.toFixed(1)}°`;
  frontWheelVal.textContent = `${(steerAngle * RAD).toFixed(1)}°`;
  hitchVal.textContent = `${(articulation * RAD).toFixed(1)}°`;
  warningEl.classList.toggle('active', trailer.hitLimit);
  wheelEl.style.transform = `rotate(${input.wheelDeg}deg)`;
}

function loop(ts) {
  if (!loop.last) loop.last = ts;
  let dt = (ts - loop.last) / 1000;
  loop.last = ts;
  dt = Math.min(dt, 0.05);

  const prev = { x: car.x, y: car.y, h: car.heading, speed: car.speed };
  const { steerAngle } = car.update(dt, input);

  if (lot.isCollision(car)) {
    car.x = prev.x; car.y = prev.y; car.heading = prev.h; car.speed = 0;
  }

  const { articulation } = trailer.update(dt, car);

  lot.draw(ctx);
  trailer.draw(ctx, car);
  car.draw(ctx, steerAngle);
  updateUI(steerAngle, articulation);

  requestAnimationFrame(loop);
}

initState();
requestAnimationFrame(loop);

document.getElementById('centerWheelBtn').addEventListener('click', () => input.centerSteering());
document.getElementById('resetBtn').addEventListener('click', () => initState());
document.getElementById('clearTraceBtn').addEventListener('click', () => trailer.resetTrace());
