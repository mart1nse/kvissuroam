// The city's own circuit (src/city.js): Toomemägi in Tartu, Pirita-Kose-Kloostrimetsa in Tallinn (tools/race/build-pirita.py,
// Martin 28 Nov 2026: "it will have all the same logic as the toomemäe circuit"). Both have the same shape (points every
// 2 m, half widths, checkpoints, spawn), so the lap, its gates, the race and the server's checks take either as they are.
// Inside the game and on the server Pirita-Kose keeps Toomemägi's ids ('toome', 'toomemagi'): Tallinn's laps live in
// Tallinn's own lobby, so the names never meet. Only what the players read is the circuit's own (CIRCUIT_NAME).
import TOOME from './track.json';
import PIRITA from './pirita.json';
import { TALLINN } from '../city.js';

export { TOOME, PIRITA };
export const TRACK = TALLINN ? PIRITA : TOOME;
export const CIRCUIT_NAME = TALLINN ? 'PIRITA-KOSE' : 'TOOMEMÄGI';
