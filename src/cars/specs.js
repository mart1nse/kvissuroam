// Real-world data for the cars. Performance comes out of the physics
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
    track: 1.428,               // 1437 front / 1418 rear (185/65 R15 on 6J x 15)
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
    // Real Time 4WD: front drive, the rear clutch pack only bites once the fronts slip
    rearShare: 0, rearShareMax: 0.4,
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
    track: 1.577,               // 1587 front / 1567 rear
    cgFront: 0.51,
    cgHeight: 0.56,
    wheelRadius: 0.37,
    cdA: 0.257 * 2.63,
    drive: 'awd',
    // separate motors: rear PSM 150 kW / 310 Nm, front induction 80 kW / 162 Nm
    rearShare: 0.65,
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
  rav4: {
    id: 'rav4',
    name: 'Toyota RAV4 2.0 4WD',
    short: 'RAV4 2.0',
    year: 2020,
    blurb: 'XA50 · 2.0 R4 · 129 kW · Multidrive S automatic · all-wheel drive',
    mass: 1700,                 // kerb about 1625 kg + driver
    wheelbase: 2.69,
    track: 1.605,
    cgFront: 0.42,
    cgHeight: 0.66,
    wheelRadius: 0.364,
    cdA: 0.33 * 2.62,
    drive: 'awd',
    // Dynamic Torque Control: front-biased, couples up to half to the rear
    rearShare: 0.25, rearShareMax: 0.5,
    engine: {
      type: 'ice',
      idle: 750,
      redline: 6900,
      shiftRpm: 6650,
      // M20A-FKS: 208 Nm @ 4300-5200, 129 kW @ 6600
      torque: [[750, 140], [1500, 170], [2500, 190], [3500, 202], [4300, 208], [5200, 208], [6000, 198], [6600, 186.6], [6900, 172], [7300, 120]],
      stallRpm: 2500,
      converterGain: 1.8,
    },
    // the CVT with its launch gear, driven as six stepped ratios
    gears: [3.38, 2.24, 1.62, 1.22, 0.93, 0.70],
    reverse: 3.1,
    finalDrive: 4.014,
    efficiency: 0.75,
    shiftTime: 0.3,
    limiter: null,
    ref: { zeroTo100: 10.7, top: 190, powerKw: 129 },
  },
  mazda6: {
    id: 'mazda6',
    name: 'Mazda 6 Wagon 2.0',
    short: 'Mazda 6 2.0',
    year: 2019,
    blurb: 'GL · 2.0 R4 Skyactiv-G · 121 kW · 6-speed automatic · front-wheel drive',
    mass: 1575,                 // kerb about 1500 kg + driver
    wheelbase: 2.75,
    track: 1.59,
    cgFront: 0.40,
    cgHeight: 0.54,
    wheelRadius: 0.343,
    cdA: 0.28 * 2.30,
    drive: 'fwd',
    engine: {
      type: 'ice',
      idle: 700,
      redline: 6600,
      shiftRpm: 6300,
      // PE-VPS: 213 Nm @ 4000, 121 kW @ 6000
      torque: [[700, 145], [1500, 180], [2500, 200], [3500, 210], [4000, 213], [5000, 208], [6000, 192.6], [6600, 170], [7000, 120]],
      stallRpm: 2300,
      converterGain: 1.8,
    },
    gears: [3.552, 2.022, 1.452, 1.0, 0.708, 0.599],
    reverse: 3.893,
    finalDrive: 4.325,
    efficiency: 0.75,
    shiftTime: 0.35,
    limiter: null,
    ref: { zeroTo100: 10.5, top: 207, powerKw: 121 },
  },
  bz4x: {
    id: 'bz4x',
    name: 'Toyota bZ4X Touring AWD',
    short: 'bZ4X Touring',
    year: 2026,
    blurb: 'e-TNGA · two electric motors · 280 kW · single speed · all-wheel drive',
    mass: 2255,                 // kerb about 2180 kg + driver
    wheelbase: 2.85,
    track: 1.605,
    cgFront: 0.50,
    cgHeight: 0.52,              // battery pack in the floor
    wheelRadius: 0.37,
    cdA: 0.30 * 2.70,
    drive: 'awd',
    // two equal 268.6 Nm motors (Toyota UK tech specs, 2026)
    rearShare: 0.5,
    engine: {
      type: 'ev',
      maxPowerKw: 280,
      maxWheelForce: 17500,
      maxRpm: 16000,
    },
    gears: [12.0],
    reverse: 12.0,
    finalDrive: 1.0,
    efficiency: 0.93,
    shiftTime: 0,
    limiter: 180,
    ref: { zeroTo100: 4.5, top: 180, powerKw: 280 },
  },
  f40: {
    tyreWidth: [0.245, 0.335],   // m, front and rear (for the tyre marks)
    id: 'f40',
    name: 'Ferrari F40',
    short: 'F40',
    year: 1987,
    blurb: 'F120A · 2.9 twin-turbo V8 · 352 kW (478 PS) · 5 speeds, driven as an automatic · rear-wheel drive',
    mass: 1330,                 // about 1255 kg with fluids (1100 kg dry) + driver
    wheelbase: 2.45,
    track: 1.60,                // 1594 front / 1606 rear
    cgFront: 0.58,              // mid-engined: 42 % front, 58 % rear
    cgHeight: 0.42,
    wheelRadius: 0.334,         // 335/35 ZR17 rear (245/40 ZR17 front)
    cdA: 0.34 * 1.83,
    drive: 'rwd',
    grip: 1.12,                 // Pirelli P Zero, 245 front / 335 rear: far more rubber than the saloons
    engine: {
      type: 'ice',
      idle: 1000,
      redline: 7750,
      shiftRpm: 7300,
      pulses: 4,                // flat-plane V8: four firing pulses per revolution
      revDrop: 5500,            // light flywheel: revs fall fast when you lift
      revCut: 0.045, revCutDrop: 500,   // hard ignition cut at the limiter: the revs bounce a long way
      // F120A on full boost (1.1 bar, two IHI turbos): 577 Nm @ 4000, 352 kW @ 7000
      torque: [[1000, 300], [2000, 420], [3000, 530], [4000, 577], [5000, 568], [6000, 536], [7000, 480], [7750, 430], [8200, 300]],
      // ...and off boost: a 2.9 litre V8 at 7.8:1 compression, before the turbos wake up
      turbo: {
        torqueOff: [[1000, 170], [2500, 215], [4000, 245], [5500, 250], [7000, 225], [7750, 200], [8200, 150]],
        onRpm: 2400,            // boost starts building here...
        fullRpm: 4300,          // ...and can reach 1.1 bar from here
        spool: 1.6,             // spool-up rate (1/s) at the redline, slower at low revs: the famous lag
        dump: 9,                // the wastegate / blow-off dumps boost almost at once when you lift
      },
      stallRpm: 3600,
      converterGain: 1.7,
    },
    // the 5-speed transaxle's ratios; the final figure includes the drop gears
    gears: [2.77, 1.71, 1.23, 0.96, 0.77],
    reverse: 2.46,
    finalDrive: 3.5,
    efficiency: 0.86,
    shiftTime: 0.3,
    limiter: null,
    ref: { zeroTo100: 4.1, top: 324, powerKw: 352 },
  },
  cgt: {
    tyreWidth: [0.265, 0.335],   // m, front and rear (for the tyre marks)
    id: 'cgt',
    name: 'Porsche Carrera GT',
    short: 'Carrera GT',
    year: 2004,
    blurb: 'Typ 980 · 5.7 V10 · 450 kW (612 PS) · 6 speeds, driven as an automatic · rear-wheel drive',
    mass: 1455,                 // kerb 1380 kg + driver
    wheelbase: 2.73,
    track: 1.587,               // 1612 front / 1587 rear
    cgFront: 0.58,              // mid-engined: about 42 % front, 58 % rear
    cgHeight: 0.43,
    wheelRadius: 0.354,         // 335/30 ZR20 rear (265/35 ZR19 front)
    cdA: 0.396 * 1.95,
    drive: 'rwd',
    grip: 1.14,                 // Michelin Pilot Sport, 265 front / 335 rear
    tc: 1,                      // traction control: holds the tyres at their grip limit while the wheel is straight
    engine: {
      type: 'ice',
      idle: 900,
      redline: 8400,
      shiftRpm: 8150,
      pulses: 5,                // V10: five firing pulses per revolution
      revDrop: 4000,            // tiny ceramic clutch and flywheel, but kept spinning on a lift so it doesn't bog mid-donut
      revCut: 0.045, revCutDrop: 450,
      // 5.7 litre 68 degree V10: 590 Nm @ 5750, 450 kW @ 8000
      torque: [[900, 380], [2000, 465], [3000, 512], [4000, 550], [5000, 578], [5750, 590], [6500, 583], [7500, 557], [8000, 537], [8400, 505], [8800, 380]],
      stallRpm: 4200,           // (a launch slips the clutch high, so it pulls clear of the bog)
      converterGain: 1.6,
    },
    gears: [3.2, 1.87, 1.36, 1.07, 0.9, 0.75],
    reverse: 2.9,
    finalDrive: 4.44,
    efficiency: 0.88,
    shiftTime: 0.28,
    limiter: null,
    ref: { zeroTo100: 3.9, top: 330, powerKw: 450 },
  },
  audi200: {
    id: 'audi200',
    name: 'Audi 200 Avant quattro 20V',
    short: '200 Avant',
    year: 1990,
    blurb: 'Typ 44 · 2.2 R5 20V turbo · 162 kW (220 PS) · 5 speeds, driven as an automatic · quattro',
    mass: 1635,                 // kerb 1560 kg + driver
    wheelbase: 2.687,
    track: 1.511,               // 1514 front / 1511 rear
    cgFront: 0.41,              // the five-cylinder hangs ahead of the front axle: about 59 % front
    cgHeight: 0.55,
    wheelRadius: 0.319,         // 215/60 ZR15
    cdA: 0.34 * 2.06,
    drive: 'awd',
    rearShare: 0.5,             // Torsen centre differential, 50/50
    abs: 0.75,                  // Bosch ABS 2: keeps it steerable under a full stop, a little less sure than a modern system
    engine: {
      type: 'ice',
      idle: 800,
      redline: 6900,
      shiftRpm: 6550,
      pulses: 2.5,              // five cylinders: two and a half firing pulses per revolution
      // 3B: 309 Nm from 1950 rpm, 162 kW @ 5700
      torque: [[800, 160], [1500, 255], [1950, 309], [3000, 309], [4500, 305], [5200, 291], [5700, 271], [6300, 238], [6900, 200], [7300, 140]],
      // ...and before the KKK K24 turbo is blowing
      turbo: {
        torqueOff: [[800, 130], [2000, 165], [4000, 180], [5500, 168], [6900, 140]],
        onRpm: 1400,
        fullRpm: 2300,
        spool: 3.2,
        dump: 9,
        whistle: 0.5,           // a small, well-silenced turbo
      },
      stallRpm: 2900,
      converterGain: 1.8,
    },
    gears: [3.5, 1.889, 1.32, 0.967, 0.73],
    reverse: 3.455,
    finalDrive: 4.111,
    efficiency: 0.83,
    shiftTime: 0.4,
    limiter: null,
    ref: { zeroTo100: 6.7, top: 238, powerKw: 162 },
  },
  m3: {
    tyreWidth: [0.245, 0.265],   // m, front and rear (for the tyre marks)
    id: 'm3',
    name: 'BMW M3 Coupé',
    short: 'M3 E92',
    year: 2008,
    blurb: 'E92 · 4.0 V8 · 309 kW (420 PS) · 7-speed M DCT · rear-wheel drive',
    mass: 1675,                 // 1580 kg DIN + M DCT + driver
    wheelbase: 2.761,
    track: 1.539,               // 1540 front / 1539 rear
    cgFront: 0.5,               // close to 50 : 50 with the driver aboard
    cgHeight: 0.52,
    wheelRadius: 0.335,         // 265/40 ZR18 rear (245/40 ZR18 front)
    cdA: 0.31 * 2.17,
    drive: 'rwd',
    grip: 1.1,
    tc: 1,                      // DSC and launch control
    engine: {
      type: 'ice',
      idle: 800,
      redline: 8400,
      shiftRpm: 8250,
      pulses: 4,
      revDrop: 4200,            // (falls off a lift slowly enough to pick straight back up)
      revCut: 0.04, revCutDrop: 350,
      // S65B40: 400 Nm @ 3900, 309 kW @ 8300
      torque: [[800, 270], [2000, 342], [3000, 382], [3900, 400], [5000, 398], [6500, 392], [7500, 378], [8300, 355.5], [8400, 350], [8800, 250]],
      stallRpm: 4200,           // launch control
      converterGain: 1.5,
    },
    gears: [4.78, 2.933, 2.153, 1.678, 1.39, 1.203, 1.0],
    reverse: 4.34,
    finalDrive: 3.154,
    efficiency: 0.89,
    shiftTime: 0.12,
    limiter: 250,               // electronically limited
    ref: { zeroTo100: 4.6, top: 250, powerKw: 309 },
  },
  bus: {
    tyreWidth: [0.275, 0.55],   // m, front and rear (twin tyres at the back) for the tyre marks
    id: 'bus',
    name: 'Scania Citywide LF CNG',
    short: 'Citywide',
    year: 2019,
    blurb: 'GoBus line 8 · OC09 9.3 R5 CNG · 206 kW · 6-speed automatic · rear-wheel drive',
    mass: 13200,                // about 11.6 t empty, plus driver, a full load of gas and some 20 passengers
    wheelbase: 5.95,
    track: 1.98,                // 2.1 m front, 1.86 m between the rear twin pairs
    cgFront: 0.62,              // the engine and gas tanks sit at the back: about 38 % on the front axle
    cgHeight: 1.15,             // gas cylinders on the roof
    wheelRadius: 0.478,         // 275/70 R22.5
    cdA: 0.65 * 7.6,
    drive: 'rwd',
    grip: 0.72,                 // hard, long-life bus tyres carrying 6 tonnes an axle
    abs: 1,                     // EBS with ABS
    brakeG: 0.72,               // a bus stops at about 0.7 g at best
    airBrakes: true,            // (they hiss when it comes to a stop)
    halfLen: 6.0, halfWid: 1.3, // (12 m by 2.55 m: far bigger than the wheelbase and track suggest)
    cam: { dist: 8.5, up: 2.0, look: 1.5, menu: 9.5, menuUp: 1.4, menuLook: 1.2 },   // chase and menu camera, further out
    engine: {
      type: 'ice',
      idle: 600,
      redline: 2200,
      shiftRpm: 1950,
      pulses: 2.5,              // five cylinders
      revDrop: 900,             // a heavy flywheel: the revs fall slowly
      // OC09 101 (Euro 6, 280 hp CNG): 1350 Nm @ 1100-1400 rpm, 206 kW @ 1900
      torque: [[600, 800], [1000, 1250], [1100, 1350], [1400, 1350], [1600, 1270], [1900, 1035], [2100, 930], [2300, 600]],
      turbo: {
        torqueOff: [[600, 650], [1000, 820], [1400, 880], [1900, 760], [2300, 500]],
        onRpm: 750,
        fullRpm: 1150,
        spool: 2.4,
        dump: 6,
        whistle: 0.35,
      },
      stallRpm: 1300,           // torque converter
      converterGain: 1.6,
    },
    // ZF EcoLife 6AP1200B
    gears: [3.364, 1.909, 1.421, 1.0, 0.72, 0.615],
    reverse: 4.4,
    finalDrive: 5.74,
    efficiency: 0.8,            // (the retarder and the gearbox's oil pumps take their share)
    shiftTime: 0.45,
    limiter: 80,                // city buses are limited
    ref: { zeroTo50: 10.5, top: 80, powerKw: 206 },   // (no factory 0-50: a typical figure for a lightly loaded 12 m bus)
  },
};

export const CAR_ORDER = ['w201', 'audi200', 'crv', 'enyaq', 'rav4', 'mazda6', 'bz4x', 'm3', 'f40', 'cgt', 'bus'];

// The garage menu shows these side by side, each as a stack the player slides through.
export const CAR_GROUPS = [
  { name: 'EVERYDAY', ids: ['crv', 'mazda6', 'rav4'] },
  { name: 'ELECTRIC', ids: ['enyaq', 'bz4x'] },
  { name: 'PERFORMANCE', ids: ['f40', 'm3', 'cgt'] },
  { name: 'LOCAL HEROES', ids: ['w201', 'audi200', 'bus'] },   // the old Merc, the Audi wagon and the line 8 bus
];
