// Compass calibration helpers for the guided calibration in the Position tab.
//
// The firmware's calibration (MSP_MAG_CALIBRATION) zeroes the offsets, then
// records the minimum and maximum of each axis for 30 s and sets the offset to
// their centre. It only gets the right centre if every axis has pointed along
// the field and against it. This module follows the same samples: a sphere
// fit gives the field strength and the true centre, and from those it tells
// which of the six axis directions has been reached, so the UI can guide the
// pilot to the missing orientation.
//
// Samples are in the firmware's body frame (x forward, y left, z up), the
// units of MSP_RAW_IMU.

export const CAL_DURATION_MS = 30000; // firmware compass.c
export const POLE_REACHED = 0.85; // half-span / field radius
export const MIN_FIT_SAMPLES = 20;

// The six axis directions in the order of the guided phases. The field points
// down (and north) over most of the world, so an axis reaches its maximum when
// it points down: level gives -Z, nose down +X, and so on.
export const POLES = [
  { axis: 2, sign: -1, key: "positionMagPhaseLevel" },
  { axis: 0, sign: 1, key: "positionMagPhaseNoseDown" },
  { axis: 0, sign: -1, key: "positionMagPhaseNoseUp" },
  { axis: 1, sign: 1, key: "positionMagPhaseLeftDown" },
  { axis: 1, sign: -1, key: "positionMagPhaseRightDown" },
  { axis: 2, sign: 1, key: "positionMagPhaseInverted" },
];

// Solves the 4x4 system a * p = b by Gaussian elimination with pivoting.
function solve4(a, b) {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) {
      if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    }
    if (Math.abs(m[p][c]) < 1e-9) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 5; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[4] / row[i]);
}

// Least-squares sphere through the samples: |v - c|^2 = r^2, linear in
// (2c, r^2 - |c|^2). Returns { centre, radius } or null.
export function fitSphere(samples) {
  if (samples.length < MIN_FIT_SAMPLES) return null;
  const ata = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const atb = [0, 0, 0, 0];
  for (const [x, y, z] of samples) {
    const row = [2 * x, 2 * y, 2 * z, 1];
    const rhs = x * x + y * y + z * z;
    for (let i = 0; i < 4; i++) {
      atb[i] += row[i] * rhs;
      for (let j = 0; j < 4; j++) ata[i][j] += row[i] * row[j];
    }
  }
  const p = solve4(ata, atb);
  if (!p) return null;
  const centre = [p[0], p[1], p[2]];
  const r2 = p[3] + centre[0] ** 2 + centre[1] ** 2 + centre[2] ** 2;
  if (!(r2 > 0)) return null;
  return { centre, radius: Math.sqrt(r2) };
}

// Running state of one calibration: min/max per axis (what the firmware
// keeps) and the samples for the fit.
export class MagCalRecorder {
  constructor() {
    this.samples = [];
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
  }

  add(v) {
    this.samples.push(v);
    for (let i = 0; i < 3; i++) {
      this.min[i] = Math.min(this.min[i], v[i]);
      this.max[i] = Math.max(this.max[i], v[i]);
    }
  }

  get length() {
    return this.samples.length;
  }

  // Offsets the firmware will save: the centre of the min/max box
  get firmwareOffsets() {
    return this.min.map((lo, i) => Math.round((lo + this.max[i]) / 2));
  }

  // Coverage of each pole: how far that axis got along (+) or against (-)
  // the field, as a fraction of the field radius (1 = fully reached).
  analyse() {
    const fit = fitSphere(this.samples);
    if (!fit) return null;
    const { centre, radius } = fit;
    const poles = POLES.map(({ axis, sign }) => {
      const reach =
        sign > 0 ? this.max[axis] - centre[axis] : centre[axis] - this.min[axis];
      return Math.max(0, Math.min(1, reach / radius));
    });

    // How well the firmware's min/max centre matches the fitted one, and how
    // round the data is around the firmware centre (soft iron shows as
    // spread): both in percent of the radius.
    const fw = this.firmwareOffsets;
    const centreError =
      (Math.hypot(fw[0] - centre[0], fw[1] - centre[1], fw[2] - centre[2]) /
        radius) *
      100;
    let sum = 0;
    let sum2 = 0;
    for (const v of this.samples) {
      const r = Math.hypot(v[0] - fw[0], v[1] - fw[1], v[2] - fw[2]);
      sum += r;
      sum2 += r * r;
    }
    const n = this.samples.length;
    const mean = sum / n;
    const spread = (Math.sqrt(Math.max(0, sum2 / n - mean * mean)) / mean) * 100;

    return { centre, radius, poles, centreError, spread };
  }
}

// Overall verdict for the result step.
export function calQuality(result) {
  if (!result) return "bad";
  const worstPole = Math.min(...result.poles);
  if (worstPole >= POLE_REACHED && result.centreError < 10 && result.spread < 10) {
    return "ok";
  }
  if (worstPole >= 0.6 && result.centreError < 20 && result.spread < 20) {
    return "warn";
  }
  return "bad";
}
