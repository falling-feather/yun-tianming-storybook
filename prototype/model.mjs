const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function angleDelta(before, after) {
  return Math.atan2(Math.sin(after - before), Math.cos(after - before));
}

function integrate(seconds, step) {
  for (let remaining = Math.max(0, seconds); remaining > 1e-9;) {
    const dt = Math.min(remaining, 1 / 60);
    step(dt);
    remaining -= dt;
  }
}

export const createUmbrella = () => ({
  phase: 'handoff', angle: 0, speed: 0, direction: 1,
  open: 0.14, progress: 0, danger: 0, transfer: 0,
});

export function takeUmbrella(state) {
  if (state.phase !== 'handoff') return;
  state.phase = 'passing';
  state.speed = 3.5;
  state.open = 1;
}

export function turnUmbrella(state, radians, elapsed) {
  if (state.phase !== 'active' || Math.abs(radians) < 0.0001) return;
  const inputSpeed = clamp(Math.abs(radians) / Math.max(0.008, elapsed), 0, 14);
  state.speed = Math.max(state.speed, inputSpeed * 0.95);
  state.direction = Math.sign(radians);
}

export function stepUmbrella(state, seconds) {
  integrate(seconds, dt => {
    if (state.phase === 'passing') {
      state.transfer = clamp(state.transfer + dt / 3);
      state.angle += dt * 3.5;
      if (state.transfer >= 1 - 1e-9) { state.transfer = 1; state.phase = 'active'; }
      return;
    }
    if (state.phase !== 'active') return;
    state.speed *= Math.exp(-0.95 * dt);
    state.angle += state.speed * dt * state.direction;
    state.open = clamp(state.speed / 2.5);
    if (state.speed >= 2.2) {
      state.progress = clamp(state.progress + dt / 6.2);
      state.danger = Math.max(0, state.danger - dt * 0.9);
    } else {
      state.danger = clamp(state.danger + dt * (1 - state.open) / 2.4);
    }
    if (state.progress === 1) state.phase = 'complete';
    else if (state.danger === 1) state.phase = 'failed';
  });
}

export const createVoyage = () => ({
  phase: 'waiting', phaseAge: 0, settled: 0,
  foam: 0, calm: 0, progress: 0, soap: 1, dipping: false,
});

export function inspectWater(state) {
  if (state.phase !== 'waiting') return;
  state.phase = 'dipping';
  state.phaseAge = 0;
}

export function stepVoyage(state, seconds, inWater) {
  integrate(seconds, dt => {
    if (state.phase === 'complete') return;
    state.phaseAge += dt;
    if (state.phase === 'waiting') return;
    if (state.phase === 'departing') {
      state.dipping = false;
      state.foam = Math.max(0, state.foam - .025 * dt);
      if (state.phaseAge > 1.8) state.progress = clamp(state.progress + dt / 8);
      if (state.progress === 1) state.phase = 'complete';
      return;
    }
    state.dipping = inWater && state.soap > 0;
    state.foam = clamp(state.foam + (state.dipping ? .38 : -.12) * dt);
    if (state.dipping) state.soap = Math.max(0, state.soap - 0.025 * dt);
    state.calm = clamp((state.foam - 0.15) / 0.55);
    state.settled = state.calm > .94 ? state.settled + dt : 0;
    if (state.settled >= 1.25) {
      state.phase = 'departing';
      state.phaseAge = 0;
      state.dipping = false;
    }
  });
}

export function perspective(position) {
  const distance = 12 - 10 * clamp(position);
  const scale = 2 / distance;
  return {
    distance, scale, princeHeight: 188,
    guardHeight: 188 * scale, treeHeight: 390 * scale,
  };
}

export const createObservation = () => ({ position: 0, sawNear: false, complete: false });

export function moveObserver(state, position) {
  state.position = clamp(position);
  if (state.position >= 0.94) state.sawNear = true;
  if (state.sawNear && state.position <= 0.1) state.complete = true;
}
