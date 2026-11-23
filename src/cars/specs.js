// Real-world data for the cars. Performance comes out of the physics
// (torque curve, gearing, mass, drag); the "ref" block holds the factory
// figures the simulation is calibrated against (see tools/perf-test.mjs).

export const CARS = {
  w201: {
    id: 'w201',
    name: 'Mercedes-Benz 190E 2.6',
    short: '190E 2.6',
    tag: '190E',                // the online lists (Martin, 2026-11-23)
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
      brakeTorque: [28, 0.0045],   // off the throttle: 2.6 litres of six-cylinder friction and pumping, the gearbox's oil pump and one differential, about 55 Nm at 6000 rpm, through a converter that slips little on the overrun (0.19 g at the top of 1st, 0.09 g at 100 in 3rd), all of it on the rear wheels
    },
    gears: [4.25, 2.41, 1.49, 1.0],
    reverse: 5.67,
    finalDrive: 3.07,
    efficiency: 0.765,
    shiftTime: 0.5,
    limiter: null,
    abs: 0.2,                   // a touch of anti-lock (Martin 2026-11-22)
    ref: { zeroTo100: 9.2, top: 210, powerKw: 118 },
  },
  crv: {
    id: 'crv',
    name: 'Honda CR-V 2.0 i-VTEC',
    short: 'CR-V 2.0',
    tag: 'CR-V',                // the online lists (Martin, 2026-11-23)
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
      hbRevs: 0,                // no handbrake clutch: an automatic SUV driven mostly through its front wheels, where the clutch drop's spin only pushes the nose wide (Martin 2026-11-22)
    },
    gears: [2.785, 1.682, 1.129, 0.773, 0.566],
    reverse: 2.0,
    finalDrive: 4.5,
    efficiency: 0.8,
    shiftTime: 0.45,
    limiter: null,
    abs: 0.2,                   // a touch of anti-lock (Martin 2026-11-22)
    ref: { zeroTo100: 12.2, top: 177, powerKw: 110 },
  },
  enyaq: {
    id: 'enyaq',
    name: 'Škoda Enyaq 80x',
    short: 'Enyaq 80x',
    tag: 'Enyaq',                // the online lists (Martin, 2026-11-23)
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
    abs: 0.2,                   // a touch of anti-lock (Martin 2026-11-22)
    ref: { zeroTo100: 6.9, top: 160, powerKw: 195 },
  },
  rav4: {
    id: 'rav4',
    name: 'Toyota RAV4 2.0 4WD',
    short: 'RAV4 2.0',
    tag: 'RAV4',                // the online lists (Martin, 2026-11-23)
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
    abs: 0.4,                   // a light anti-lock: the wheels half lock under a full stop, the car still steers a little
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
      hbRevs: 0,                // no handbrake clutch: an automatic SUV driven mostly through its front wheels, where the clutch drop's spin only pushes the nose wide (Martin 2026-11-22)
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
  passat: {
    id: 'passat',
    name: 'Volkswagen Passat Variant 1.9 TDI',
    short: 'Passat TDI',
    tag: 'Passat',                // the online lists (Martin, 2026-11-23)
    year: 1998,
    blurb: 'B5 · 1.9 R4 TDI · 81 kW · 5-speed · front-wheel drive · tired DPF, smokes on throttle',
    mass: 1475,                 // kerb about 1395 kg + driver
    wheelbase: 2.703,
    track: 1.499,               // 1498 front / 1500 rear, 195/65 R15 on steel wheels with covers
    cgFront: 0.38,              // a cast-iron diesel hung out over the front axle: 62 % front weight
    cgHeight: 0.56,
    wheelRadius: 0.317,
    cdA: 0.285 * 2.12,
    drive: 'fwd',
    abs: 0.8,                   // Bosch ABS 5.3
    dpfSmoke: true,             // black smoke on throttle, and soot building up on the tailgate (see smoke.js)
    exhaust: { x: -0.42, y: 0.27, back: 0.99 },   // tailpipe: left, under the bumper, behind the rear axle
    engine: {
      type: 'ice',
      idle: 850,
      redline: 4800,
      shiftRpm: 4350,
      revDrop: 2400,            // heavy dual-mass flywheel: the revs sink slowly after a lift
      // AFN: 235 Nm @ 1900, 81 kW @ 4150 with the variable-vane turbo up to pressure
      torque: [[850, 105], [1300, 150], [1600, 200], [1900, 235], [2500, 232], [3000, 222], [3500, 206], [4150, 186.4], [4500, 160], [4800, 95], [5100, 40]],
      // ...and with no boost, a 1.9 litre diesel on its own
      turbo: {
        torqueOff: [[850, 95], [1500, 112], [2500, 122], [3500, 115], [4500, 95], [5100, 40]],
        onRpm: 1250,            // the VNT turbo starts building boost early...
        fullRpm: 1900,          // ...and is on full boost from here
        spool: 1.5,             // an old VNT turbo: a short wait before it comes in when you floor it
        dump: 6,
        bov: { kind: 'diesel', level: 0.9 },     // no throttle and no valve: the boost only breathes off
      },
      stallRpm: 2000,
      converterGain: 1.9,
    },
    gears: [3.778, 2.118, 1.36, 0.971, 0.756],
    reverse: 3.6,
    finalDrive: 3.389,
    efficiency: 0.86,
    shiftTime: 0.4,
    limiter: null,
    ref: { zeroTo100: 11.5, top: 193, powerKw: 81 },
  },
  mazda6: {
    id: 'mazda6',
    name: 'Mazda 6 Wagon 2.0',
    short: 'Mazda 6 2.0',
    tag: 'Mazda6',                // the online lists (Martin, 2026-11-23)
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
    abs: 0.4,                   // a light anti-lock, as on the RAV4
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
    tag: 'bZ4X',                // the online lists (Martin, 2026-11-23)
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
    abs: 0.2,                   // a touch of anti-lock (Martin 2026-11-22)
    ref: { zeroTo100: 4.5, top: 180, powerKw: 280 },
  },
  f40: {
    tyreWidth: [0.245, 0.335],   // m, front and rear (for the tyre marks)
    id: 'f40',
    name: 'Ferrari F40',
    short: 'F40',
    tag: 'F40',                // the online lists (Martin, 2026-11-23)
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
      brakeDown: 0.86,          // braking into a corner it comes down early and keeps the revs up
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
        // blow-off valves open to the air: a loud pssh that often chatters out in chunks, and a short
        // one in the gap of an upshift on boost (src/audio-turbo.js)
        bov: { kind: 'vent', level: 1, chunks: 1, flutter: 0.15, shift: 1.6 },
      },
      stallRpm: 3600,
      rollStallRpm: 4200,       // floored on the move it bites like a dropped clutch: higher revs, and the rears go up in smoke once the boost arrives
      converterGain: 1.7,       // (only with ?launch=0: the cars start like manuals now)
      // floored in first the clutch is kept slipping at 4300 rpm, where the boost is full: its long first
      // gear and weak off-boost torque bogged in donuts and launches otherwise (src/cars/physics.js)
      clutchSlip: true,
    },
    // the 5-speed transaxle's ratios; the final figure includes the drop gears
    gears: [2.77, 1.71, 1.23, 0.96, 0.77],
    reverse: 2.46,
    finalDrive: 3.5,
    efficiency: 0.86,
    shiftTime: 0.3,
    limiter: null,
    abs: 0.2,                   // the real car has none; a touch so a full stop still steers a little (Martin 2026-11-22)
    ref: { zeroTo100: 4.1, top: 324, powerKw: 352 },
  },
  cgt: {
    tyreWidth: [0.265, 0.335],   // m, front and rear (for the tyre marks)
    id: 'cgt',
    name: 'Porsche Carrera GT',
    short: 'Carrera GT',
    tag: 'Carrera GT',                // the online lists (Martin, 2026-11-23)
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
    tcSlip: 2,                  // ...but floored on the move it lets them spin up a little first
    engine: {
      type: 'ice',
      idle: 900,
      redline: 8400,
      shiftRpm: 8150,
      brakeDown: 0.86,          // braking into a corner it comes down early and keeps the revs up
      pulses: 5,                // V10: five firing pulses per revolution
      revDrop: 4000,            // tiny ceramic clutch and flywheel, but kept spinning on a lift so it doesn't bog mid-donut
      revCut: 0.045, revCutDrop: 450,
      // 5.7 litre 68 degree V10: 590 Nm @ 5750, 450 kW @ 8000
      torque: [[900, 380], [2000, 465], [3000, 512], [4000, 550], [5000, 578], [5750, 590], [6500, 583], [7500, 557], [8000, 537], [8400, 505], [8800, 380]],
      stallRpm: 4200,           // (a launch slips the clutch high, so it pulls clear of the bog)
      rollStallRpm: 5600,       // floored on the move the clutch bites higher, like a manual
      converterGain: 1.6,
    },
    gears: [3.2, 1.87, 1.36, 1.07, 0.9, 0.75],
    reverse: 2.9,
    finalDrive: 4.44,
    efficiency: 0.88,
    shiftTime: 0.28,
    limiter: null,
    abs: 0.2,                   // a touch of anti-lock (Martin 2026-11-22)
    ref: { zeroTo100: 3.9, top: 330, powerKw: 450 },
  },
  audi200: {
    id: 'audi200',
    name: 'Audi 200 Avant quattro 20V',
    short: '200 Avant',
    tag: '200 Avant',                // the online lists (Martin, 2026-11-23)
    year: 1990,
    blurb: 'Typ 44 · 2.2 R5 20V turbo · 162 kW (220 PS) · 5 speeds, driven as an automatic · quattro',
    mass: 1635,                 // kerb 1560 kg + driver
    wheelbase: 2.687,
    track: 1.511,               // 1514 front / 1511 rear
    cgFront: 0.41,              // the five-cylinder hangs ahead of the front axle: about 59 % front
    cgHeight: 0.55,
    wheelRadius: 0.326,         // 245/40 R18 on BBS wheels (was 215/60 ZR15)
    cdA: 0.34 * 2.06,
    drive: 'awd',
    rearShare: 0.5,             // Torsen centre differential, 50/50
    abs: 0.75,                  // Bosch ABS 2: keeps it steerable under a full stop, a little less sure than a modern system
    engine: {
      type: 'ice',
      idle: 800,
      redline: 6900,
      shiftRpm: 6550,
      brakeDown: 0.86,          // braking into a corner it comes down early and keeps the revs up
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
        bov: { kind: 'recirc', level: 0.8, flutter: 0.7 },   // a diverter valve: a whoosh, often after a stu-tu-tu of compressor surge
      },
      stallRpm: 2900,
      converterGain: 1.8,
      clutchSlip: 0.3,          // a bit of the slipping clutch (Martin 2026-11-23)
      brakeTorque: [32, 0.0042],   // off the throttle: 2.2 litres of five-cylinder friction and pumping (one more cylinder's rings and bearings than the 22B) plus three differentials, about 57 Nm at 6000 rpm (0.17 g at the top of 1st, 0.12 g at 100 in 2nd), split evenly by the Torsen
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
    tag: 'M3',                // the online lists (Martin, 2026-11-23)
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
    tcSlip: 2,                  // M Dynamic mode: floored on the move the rears may spin up a little
    engine: {
      type: 'ice',
      idle: 800,
      redline: 8400,
      shiftRpm: 8250,
      brakeDown: 0.86,          // braking into a corner it comes down early and keeps the revs up
      pulses: 4,
      revDrop: 4200,            // (falls off a lift slowly enough to pick straight back up)
      revCut: 0.04, revCutDrop: 350,
      // S65B40: 400 Nm @ 3900, 309 kW @ 8300
      torque: [[800, 270], [2000, 342], [3000, 382], [3900, 400], [5000, 398], [6500, 392], [7500, 378], [8300, 355.5], [8400, 350], [8800, 250]],
      stallRpm: 4200,           // launch control
      rollStallRpm: 5600,       // floored on the move the clutch bites higher, like a manual
      converterGain: 1.5,
    },
    gears: [4.78, 2.933, 2.153, 1.678, 1.39, 1.203, 1.0],
    reverse: 4.34,
    finalDrive: 3.154,
    efficiency: 0.89,
    shiftTime: 0.12,
    limiter: null,              // de-limited: the factory 250 km/h cap is off, drag and gearing set the top speed
    abs: 0.2,                   // a touch of anti-lock (Martin 2026-11-22)
    ref: { zeroTo100: 4.6, top: 300, powerKw: 309 },   // de-limited E92 M3: about 295-305 km/h true speed, set by drag in 7th
  },
  impreza: {
    tyreWidth: [0.235, 0.235],   // m, front and rear (for the tyre marks)
    id: 'impreza',
    name: 'Subaru Impreza 22B STi',
    short: '22B STi',
    tag: 'STI',                // the online lists (Martin, 2026-11-23)
    year: 1998,
    blurb: 'GC8 · 2.2 flat-four turbo · 280 PS on paper, about 305 hp for real · 5 speeds, driven as an automatic · all-wheel drive',
    mass: 1345,                 // kerb 1270 kg + driver
    wheelbase: 2.52,
    track: 1.49,                // 1480 front / 1500 rear: the wide body of the rally car
    cgFront: 0.43,              // the flat four sits ahead of the front axle: about 57 % front with the driver in
    cgHeight: 0.48,             // ...but low: a boxer's crank is at hub height
    wheelRadius: 0.31,          // 235/40 ZR17 on 8.5J BBS wheels
    cdA: 0.36 * 2.05,
    drive: 'awd',
    rearShare: 0.65,            // DCCD centre differential left open: 35 : 65, the tail-happy setting (Martin's notes, 22 Nov)
    grip: 1.08,                 // Pirelli P Zero 235s under 1270 kg
    abs: 0.25,                  // the real car has none; a tad is left so a full stop still steers a little (Martin 2026-11-22)
    // one big tailpipe on the left; a downshift's crackle shows as a lick of flame there (smoke.js)
    exhaust: { x: -0.454, y: 0.255, back: 0.885, flame: true },
    engine: {
      type: 'ice',
      idle: 850,
      redline: 7900,
      shiftRpm: 7500,
      brakeDown: 0.86,          // braking into a corner it comes down early and keeps the revs up
      pulses: 2,                // four cylinders: two firing pulses per revolution
      revDrop: 4200,
      brakeTorque: [30, 0.004],    // off the throttle: 2.2 litres of friction and pumping plus three differentials, about 54 Nm at 6000 rpm (0.19 g at the top of 1st, 0.12 g in 2nd, 0.05 g in 5th)
      revCut: 0.045, revCutDrop: 400,
      // EJ22G on full boost as stock cars measure, not as Subaru put it on paper (280 PS, 363 Nm, the
      // Japanese makers' agreed cap): about 385 Nm @ 3200 and 227 kW (305 hp) @ 6000 at the crank,
      // which is some 240 hp at the wheels (Martin's notes, 22 Nov)
      torque: [[850, 150], [1500, 205], [2000, 265], [2600, 342], [3200, 385], [4000, 385], [5000, 376], [6000, 361], [6500, 334], [7000, 300], [7900, 240], [8300, 150]],
      // ...and off boost: 2.2 litres at 8.0 : 1 compression
      turbo: {
        torqueOff: [[850, 125], [2000, 160], [3500, 182], [5000, 178], [6500, 160], [7900, 132], [8300, 100]],
        onRpm: 1900,            // nothing much below 2000...
        fullRpm: 3100,          // ...then it all arrives by 3200
        spool: 2.6,             // an IHI RHF5HB: a short wait when you floor it low down
        dump: 9,
        whistle: 0.8,
        bov: { kind: 'recirc', level: 0.85, flutter: 0.5 },   // the factory valve feeds the air back in: a whoosh, and a flutter when it is caught out
      },
      stallRpm: 3900,           // a launch slips the clutch high, all four wheels biting
      hbRevs: 6000,             // the handbrake takes the drive off (a rally handbrake turn): the engine is kept up here at its power peak, or revs on up with the throttle
      rollStallRpm: 5200,
      converterGain: 1.6,
      clutchSlip: 0.15,         // a touch of the slipping clutch (Martin 2026-11-23)
    },
    // close-ratio 5-speed (the STi Type R's set) on a 4.444 final drive, as the Japanese catalogue lists the
    // 22B: the gears top out at about 66, 99, 132 and 178 km/h, and 5th reaches the redline at 250
    gears: [3.083, 2.062, 1.545, 1.151, 0.825],
    reverse: 3.416,
    finalDrive: 4.444,
    efficiency: 0.78,              // three differentials to turn: 305 hp at the crank is about 240 at the wheels
    shiftTime: 0.3,
    limiter: null,              // no 180 km/h home-market cap: 5th runs out of revs at about 250
    ref: { zeroTo100: 4.7, top: 248, powerKw: 227 },   // the quickest road tests (they run 4.7 to 5.3 s); about 248 km/h unrestricted; power as measured, not the 206 kW on paper
  },
  bus: {
    tyreWidth: [0.275, 0.55],   // m, front and rear (twin tyres at the back) for the tyre marks
    id: 'bus',
    name: 'Scania Citywide LF CNG',
    short: 'Citywide',
    tag: 'Liinibuss',                // the online lists (Martin, 2026-11-23)
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
        bov: { kind: 'recirc', level: 0.5, flutter: 0, shift: 0 },   // an automatic: no lift, so no blow-off on its upshifts
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
    limiter: null,              // no 80 km/h governor: the gearing and the redline set the top speed
    ref: { zeroTo50: 10.5, top: 112, powerKw: 206 },  // (no factory 0-50: a typical figure for a lightly loaded 12 m bus; top: 2200 rpm in sixth with no governor)
  },
};

// The handbrake clutch (engine.hbRevs, see engineForce in physics.js) is standard on every
// four-wheel-drive car with an engine, these and any added later (Martin 2026-11-22): pulling the
// handbrake takes the drive off, the revs stay up, and letting go lights the tyres. A car that does not
// give its own hbRevs keeps the revs at its power peak (read off its torque curve below the redline);
// hbRevs: 0 turns it off for one car. Electric cars have no clutch to drop and are left as they are.
for (const s of Object.values(CARS)) {
  const e = s.engine;
  if (s.drive !== 'awd' || e.type !== 'ice' || e.hbRevs !== undefined) continue;
  let best = 0;
  for (const [rpm, nm] of e.torque) if (rpm <= e.redline && rpm * nm > best) { best = rpm * nm; e.hbRevs = rpm; }
}

export const CAR_ORDER = ['w201', 'audi200', 'passat', 'crv', 'enyaq', 'rav4', 'mazda6', 'bz4x', 'm3', 'impreza', 'f40', 'cgt', 'bus'];

// The garage menu shows these side by side, each as a stack the player slides through.
export const CAR_GROUPS = [
  { name: 'EVERYDAY', ids: ['passat', 'crv', 'mazda6', 'rav4'] },
  { name: 'ELECTRIC', ids: ['enyaq', 'bz4x'] },
  { name: 'PERFORMANCE', ids: ['f40', 'm3', 'cgt', 'impreza'] },
  { name: 'LOCAL HEROES', ids: ['w201', 'audi200', 'bus'] },   // the old Merc, the Audi wagon and the line 8 bus
];
