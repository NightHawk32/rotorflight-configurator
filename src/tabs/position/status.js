// Mirrors the firmware: POS_STATUS_* (flight/position.h), AH_STATUS_*
// (flight/althold.h), FLOW_STATUS_* (flight/position.c) and
// hardDeckState_e (flight/harddeck.h).

export const POS = {
  ALT_VALID: 1 << 0,
  KF_VALID: 1 << 1,
  AGL_VALID: 1 << 2,
  XY_VALID: 1 << 3,
  ANCHOR_FRESH: 1 << 4,
  INVERTED: 1 << 5,
  BARO_GATED: 1 << 6,
  HAVE_BARO: 1 << 7,
  HAVE_GPS_ALT: 1 << 8,
  XY_GPS_FRESH: 1 << 9,
  XY_FLOW_FRESH: 1 << 10,
  XY_CLAMPED: 1 << 11,
  XY_GPS_ORIGIN: 1 << 12,
  RANGEFINDER: 1 << 13,
  FLOW: 1 << 14,
  FLOW_HEALTHY: 1 << 15,
};

export const AH = {
  ENGAGED: 1 << 0,
  USING_AGL: 1 << 1,
  SOURCE_VALID: 1 << 2,
  STICK: 1 << 3,
  YIELDED: 1 << 4,
};

export const FLOW_STATUS_KEYS = [
  "positionFlowStatusFused",
  "positionFlowStatusDisabled",
  "positionFlowStatusNoSensor",
  "positionFlowStatusNoAgl",
  "positionFlowStatusLowQuality",
  "positionFlowStatusTilt",
];

export const HARDDECK_STATE_KEYS = [
  "positionHardDeckStateOff",
  "positionHardDeckStateWait",
  "positionHardDeckStateWatch",
  "positionHardDeckStatePullup",
  "positionHardDeckStateFlip",
  "positionHardDeckStateClimb",
  "positionHardDeckStateHold",
  "positionHardDeckStateExit",
];

// Option tables, index = firmware enum value
export const RANGEFINDER_HARDWARE = ["NONE", "HCSR04", "TFMINI", "TF02", "MICROLINK"];
export const OPTICAL_FLOW_HARDWARE = ["NONE", "MICROLINK"];
export const ALT_SOURCES = ["DEFAULT", "BARO_ONLY", "GPS_ONLY", "LIDAR_ONLY"];
export const XY_SOURCES = ["AUTO", "GPS_ONLY", "FLOW_ONLY"];

export function has(flags, bit) {
  return (flags & bit) !== 0;
}

export function toOptions(names) {
  return names.map((label, value) => ({ value, label }));
}

// cm -> "1.23 m"
export function meters(cm, digits = 2) {
  return `${(cm / 100).toFixed(digits)} m`;
}
