// Real-world data for the three cars. Performance comes out of the physics
// (torque curve, gearing, mass, drag); the "ref" block holds the factory
// figures the simulation is calibrated against (see tools/perf-test.mjs).

export const CARS = {
  w201: {
    id: 'w201',
    name: 'Mercedes-Benz 190E 2.6',
    short: '190E 2.6',
    year: 1987,
    blurb: 'W201 · 2.6 R6 · 118 kW · 4-speed automatic · rear-wheel drive',
    mass: 1305,                 // kerb 1230 kg (automatic) + driver
    wheelbase: 2.665,
    track: 1.44,
    cgFront: 0.47,              // share of wheelbase behind the front axle -> 53 % front weight
    cgHeight: 0.52,
    wheelRadius: 0.303,
    cdA: 0.33 * 1.93,
    drive: 'rwd',
    engine: {
      type: 'ice',
      idle: 750,
      redline: 6300,
      shiftRpm: 6000,
      // M103.940: 220 Nm @ 4600, 118 kW @ 5800
      torque: [[750, 150], [1500, 178], [2500, 198], [3500, 211], [4600, 220], [5200, 212], [5800, 194], [6300, 172], [6800, 130]],
      stallRpm: 2300,           // torque-converter stall speed
      converterGain: 1.75,
    },
    gears: [4.25, 2.41, 1.49, 1.0],
    reverse: 5.67,
    finalDrive: 3.07,
    efficiency: 0.765,
    shiftTime: 0.5,
    limiter: null,
    ref: { zeroTo100: 9.2, top: 210, powerKw: 118 },
  },
  crv: {
    id: 'crv',
    name: 'Honda CR-V 2.0 i-VTEC',
    short: 'CR-V 2.0',
    year: 2007,
    blurb: 'RE5 · 2.0 R4 · 110 kW · 5-speed automatic · Real Time 4WD',
    mass: 1650,                 // kerb 1575 kg (automatic) + driver
    wheelbase: 2.62,
    track: 1.565,
    cgFront: 0.42,
    cgHeight: 0.66,
    wheelRadius: 0.362,
    cdA: 0.36 * 2.58,
    drive: 'awd',
    engine: {
      type: 'ice',
      idle: 750,
      redline: 6800,
      shiftRpm: 6500,
      // R20A2: 192 Nm @ 4200, 110 kW @ 6200
      torque: [[750, 130], [1500, 160], [2500, 176], [3500, 187], [4200, 192], [5000, 187], [6200, 169.4], [6800, 150], [7200, 110]],
      stallRpm: 2400,
      converterGain: 1.9,
    },
    gears: [2.785, 1.682, 1.129, 0.773, 0.566],
    reverse: 2.0,
    finalDrive: 4.5,
    efficiency: 0.8,
    shiftTime: 0.45,
    limiter: null,
    ref: { zeroTo100: 12.2, top: 177, powerKw: 110 },
  },
  enyaq: {
    id: 'enyaq',
    name: 'Škoda Enyaq 80x',
    short: 'Enyaq 80x',
    year: 2023,
    blurb: 'MEB · two electric motors · 195 kW · single speed · all-wheel drive',
    mass: 2310,                 // kerb 2235 kg + driver
    wheelbase: 2.765,
    track: 1.59,
    cgFront: 0.51,
    cgHeight: 0.56,
    wheelRadius: 0.37,
    cdA: 0.257 * 2.63,
    drive: 'awd',
    engine: {
      type: 'ev',
      maxPowerKw: 195,
      maxWheelForce: 11800,     // 425 Nm system torque through ~11:1 reduction
      maxRpm: 16000,
    },
    gears: [11.0],
    reverse: 11.0,
    finalDrive: 1.0,
    efficiency: 0.9,
    shiftTime: 0,
    limiter: 160,
    ref: { zeroTo100: 6.9, top: 160, powerKw: 195 },
  },
};

export const CAR_ORDER = ['w201', 'crv', 'enyaq'];
