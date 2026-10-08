// Optical flow orientation detection.
//
// The firmware rotates every flow sample into the body frame (x forward,
// y left) according to optical_flow_align (sensors/optical_flow.c), so the
// flow in MSP2_POSITION_STATUS is already aligned with the current setting.
// The check below measures what is still wrong on top of that and composes
// it with the current setting.
//
// Index = firmware opticalFlowAlign_e. CWn: the sensor's X axis points n
// degrees clockwise from the nose, seen from above. FLIP mirrors the
// sensor's Y axis before the rotation.
export const OPTICAL_FLOW_ALIGN = [
  "CW0",
  "CW90",
  "CW180",
  "CW270",
  "CW0FLIP",
  "CW90FLIP",
  "CW180FLIP",
  "CW270FLIP",
];

// Sensor -> body matrix [[xx, xy], [yx, yy]] of each setting, matching
// opticalFlowAlign() in the firmware
export function alignMatrix(index) {
  const flip = index >= 4 ? -1 : 1;
  const [c, s] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ][index % 4];
  // body = R(theta) * diag(1, flip) * sensor, R = [[c, s], [-s, c]]
  return [
    [c, s * flip],
    [-s, c * flip],
  ];
}

function mul(a, b) {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

function apply(m, v) {
  return [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
}

function sameMatrix(a, b) {
  return (
    a[0][0] === b[0][0] &&
    a[0][1] === b[0][1] &&
    a[1][0] === b[1][0] &&
    a[1][1] === b[1][1]
  );
}

const RAD = Math.PI / 180;

// Minimum integrated flow of a slide, "cm at 1 m" (about 0.2 m of travel
// at 1 m height)
export const MIN_SLIDE = 20;
// Minimum RMS body rate of the rocking step, deg/s
export const MIN_ROCK_RATE = 20;
// A slide that ends up more than this far off its axis is not trusted, deg
export const MAX_AXIS_ERROR = 30;

// Accumulates one recording step. Samples are { t (ms), flowX, flowY,
// quality, gyroRoll, gyroPitch (deg/s) } as reported by the firmware.
export class Recorder {
  constructor() {
    this.samples = [];
    this.sum = [0, 0];
    this.qualitySum = 0;
  }

  add(sample) {
    const prev = this.samples.at(-1);
    if (prev) {
      // Sample and hold: the flow value covers the time since the previous poll
      const dt = Math.min((sample.t - prev.t) / 1000, 0.5);
      this.sum[0] += sample.flowX * dt;
      this.sum[1] += sample.flowY * dt;
    }
    this.qualitySum += sample.quality;
    this.samples.push(sample);
  }

  // Integrated flow, "cm at 1 m", current output frame
  get vector() {
    return this.sum;
  }

  get length() {
    return Math.hypot(this.sum[0], this.sum[1]);
  }

  get meanQuality() {
    return this.samples.length ? this.qualitySum / this.samples.length : 0;
  }

  get rmsRate() {
    if (!this.samples.length) return 0;
    let s = 0;
    for (const p of this.samples) {
      s += p.gyroRoll ** 2 + p.gyroPitch ** 2;
    }
    return Math.sqrt(s / this.samples.length);
  }
}

// Angle of a vector to a target direction, deg
function angleTo(v, target) {
  const dot = v[0] * target[0] + v[1] * target[1];
  const cos = dot / (Math.hypot(...v) * Math.hypot(...target));
  return Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
}

// Detect the orientation from a forward slide and a right slide (integrated
// flow vectors in the current output frame).
//
// Returns { align, correction, forwardError, rightError, orthogonality } or
// { error } when the slides are not usable.
export function detectAlignment(forward, right, currentAlign) {
  if (Math.hypot(...forward) < MIN_SLIDE || Math.hypot(...right) < MIN_SLIDE) {
    return { error: "positionFlowAlignErrorTooShort" };
  }

  // The two slides must be roughly perpendicular, otherwise one of them was
  // not straight and mirroring cannot be told apart from rotation
  const orthogonality = Math.abs(90 - angleTo(forward, right));
  if (orthogonality > MAX_AXIS_ERROR) {
    return { error: "positionFlowAlignErrorNotPerpendicular", orthogonality };
  }

  // Body frame targets: forward = +x, right = -y
  const FWD = [1, 0];
  const RIGHT = [0, -1];

  let best = null;
  for (let k = 0; k < OPTICAL_FLOW_ALIGN.length; k++) {
    // Candidate correction on top of the current output
    const c = alignMatrix(k);
    const f = apply(c, forward);
    const r = apply(c, right);
    const score =
      (f[0] * FWD[0] + f[1] * FWD[1]) / Math.hypot(...f) +
      (r[0] * RIGHT[0] + r[1] * RIGHT[1]) / Math.hypot(...r);
    if (!best || score > best.score) {
      best = { score, correction: c, f, r };
    }
  }

  const forwardError = angleTo(best.f, FWD);
  const rightError = angleTo(best.r, RIGHT);
  if (Math.max(forwardError, rightError) > MAX_AXIS_ERROR) {
    return { error: "positionFlowAlignErrorOffAxis", forwardError, rightError };
  }

  // New setting = correction * current setting
  const total = mul(best.correction, alignMatrix(currentAlign));
  const align = OPTICAL_FLOW_ALIGN.findIndex((_, k) =>
    sameMatrix(alignMatrix(k), total),
  );

  return {
    align,
    correction: best.correction,
    forwardError,
    rightError,
    orthogonality,
  };
}

// Body-rate compensation from the rocking step.
//
// The firmware (flight/position.c) fuses
//     flowFwd  = X + comp * pitchRate(rad/s)
//     flowLeft = Y - comp * rollRate(rad/s)
// and both must stay near zero while the model only rotates. Least squares
// over both axes gives the comp that cancels the rotation best, in the
// firmware's units (percent of the physical value: 100 cm/s at 1 m per
// rad/s). The flow is first corrected with the detected orientation.
//
// Returns { comp, compPitch, compRoll, residual } or { error }.
export function detectGyroComp(samples, correction) {
  let numP = 0;
  let denP = 0;
  let numR = 0;
  let denR = 0;
  let raw = 0;

  for (const s of samples) {
    const [x, y] = apply(correction, [s.flowX, s.flowY]);
    const p = s.gyroPitch * RAD;
    const r = s.gyroRoll * RAD;
    numP += -x * p;
    denP += p * p;
    numR += y * r;
    denR += r * r;
    raw += x * x + y * y;
  }
  const num = numP + numR;
  const den = denP + denR;

  if (!samples.length || den <= 0) {
    return { error: "positionFlowAlignErrorNoRotation" };
  }

  const comp = num / den;

  // Share of the raw flow that the fitted compensation leaves over
  let left = 0;
  for (const s of samples) {
    const [x, y] = apply(correction, [s.flowX, s.flowY]);
    const fx = x + comp * s.gyroPitch * RAD;
    const fy = y - comp * s.gyroRoll * RAD;
    left += fx * fx + fy * fy;
  }

  return {
    comp,
    compPitch: denP > 0 ? numP / denP : null,
    compRoll: denR > 0 ? numR / denR : null,
    residual: raw > 0 ? Math.sqrt(left / raw) : 1,
  };
}
