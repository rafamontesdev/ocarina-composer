/*
 * Datos de notas de la ocarina (Ocarina of Time, Nintendo Switch 2).
 * Basado en la tabla de https://github.com/nintenxu/ocarina-of-time-note-chart (CC BY 4.0)
 *
 * Botones base:  L = D5 · R = F5 · A = A5 · Y = B5 · X = D6
 *   S+ / S-  → stick izquierdo arriba / abajo  (± 1 tono)   ⇧ ⇩
 *   D+ / D-  → cruceta arriba / abajo          (± ½ tono)   ↑ ↓
 */
'use strict';

window.OOT = (function () {
  const MIN = 72; // C5
  const MAX = 88; // E6

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

  // clase de altura → [índice de letra, alteración]
  const SHARP_SPELL = [[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
  const FLAT_SPELL  = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];

  // Combinaciones posibles para cada nota MIDI (la primera es la "principal").
  const OPTIONS = {
    72: [['L', 'S-']],
    73: [['L', 'D-']],
    74: [['L', null]],
    75: [['L', 'D+']],
    76: [['L', 'S+'], ['R', 'D-']],
    77: [['R', null]],
    78: [['R', 'D+']],
    79: [['A', 'S-'], ['R', 'S+']],
    80: [['A', 'D-']],
    81: [['A', null]],
    82: [['Y', 'D-'], ['A', 'D+']],
    83: [['Y', null]],
    84: [['X', 'S-'], ['Y', 'D+']],
    85: [['X', 'D-']],
    86: [['X', null]],
    87: [['X', 'D+']],
    88: [['X', 'S+']],
  };

  const MOD_TEXT = { 'S+': '⇧', 'S-': '⇩', 'D+': '↑', 'D-': '↓' };
  const MOD_LABEL = {
    'S+': 'stick izquierdo arriba',
    'S-': 'stick izquierdo abajo',
    'D+': 'cruceta arriba',
    'D-': 'cruceta abajo',
  };

  const DURATIONS = {
    w: { beats: 4, label: 'Redonda' },
    h: { beats: 2, label: 'Blanca' },
    q: { beats: 1, label: 'Negra' },
    e: { beats: 0.5, label: 'Corchea' },
    s: { beats: 0.25, label: 'Semicorchea' },
  };

  const TIME_SIGS = { '4/4': 4, '3/4': 3, '2/4': 2, '6/8': 3, free: null };

  function spell(midi, acc) {
    const sp = (acc === 'flat' ? FLAT_SPELL : SHARP_SPELL)[midi % 12];
    return { letter: sp[0], acc: sp[1], octave: Math.floor(midi / 12) - 1 };
  }

  function accText(a) { return a === 1 ? '♯' : a === -1 ? '♭' : ''; }

  /** settings: { naming: 'solfege'|'letters', acc: 'sharp'|'flat', octave: bool } */
  function noteName(midi, settings) {
    const s = spell(midi, settings.acc);
    const base = settings.naming === 'letters' ? LETTERS[s.letter] : SOLFEGE[s.letter];
    return base + accText(s.acc) + (settings.octave ? s.octave : '');
  }

  /** Posición en el pentagrama (clave de sol): 0 = primera línea (Mi4), 1 = primer espacio... */
  function staffStep(midi, acc) {
    const s = spell(midi, acc);
    return (s.octave - 4) * 7 + s.letter - 2;
  }

  function options(midi) { return OPTIONS[midi] || []; }

  function defaultOption(midi, method) {
    const opts = options(midi);
    let i = -1;
    if (method === 'dpad') i = opts.findIndex(o => o[1] && o[1][0] === 'D');
    else i = opts.findIndex(o => !o[1] || o[1][0] === 'S');
    return i >= 0 ? i : 0;
  }

  /** Devuelve la combinación [botón, modificador] elegida para una nota. */
  function chosenOption(note, method) {
    const opts = options(note.midi);
    if (note.alt != null && opts[note.alt]) return opts[note.alt];
    return opts[defaultOption(note.midi, method)] || null;
  }

  function comboText(opt) {
    if (!opt) return '?';
    return opt[0] + (opt[1] ? MOD_TEXT[opt[1]] : '');
  }

  function comboLabel(opt) {
    if (!opt) return '';
    return opt[0] + (opt[1] ? ' + ' + MOD_LABEL[opt[1]] : '');
  }

  function beats(el) {
    const d = DURATIONS[el.dur] || DURATIONS.q;
    return el.dot ? d.beats * 1.5 : d.beats;
  }

  function measureBeats(ts) {
    return TIME_SIGS[ts] === undefined ? null : TIME_SIGS[ts];
  }

  /** Lleva una nota MIDI cualquiera al rango de la ocarina moviéndola por octavas. */
  function fold(midi) {
    while (midi < MIN) midi += 12;
    while (midi > MAX) midi -= 12;
    return midi;
  }

  function inRange(midi) { return midi >= MIN && midi <= MAX; }

  function isBlack(midi) { return [1, 3, 6, 8, 10].includes(midi % 12); }

  return {
    MIN, MAX, DURATIONS, MOD_TEXT, MOD_LABEL,
    spell, accText, noteName, staffStep, options, defaultOption, chosenOption,
    comboText, comboLabel, beats, measureBeats, fold, inRange, isBlack,
  };
})();
