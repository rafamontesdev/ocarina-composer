/* Lógica principal del compositor. */
'use strict';

(function () {
  const LS_SCORES = 'oot-composer:scores';
  const LS_SETTINGS = 'oot-composer:settings';
  const LS_CURRENT = 'oot-composer:current';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('No se pudo guardar en el navegador'); return false; }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- canción de ejemplo ---------- */

  function parseMelody(str) {
    const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return str.trim().split(/\s+/).map(tok => {
      if (tok === '|') return { type: 'bar' };
      const [p, d = 'q'] = tok.split(':');
      const dot = d.endsWith('.');
      const dur = d.replace('.', '');
      if (p === 'r') return { type: 'rest', dur, dot };
      const midi = PC[p[0]] + (parseInt(p.slice(1), 10) + 1) * 12;
      return { type: 'note', midi, dur, dot };
    });
  }

  function demoScore() {
    const p1 = 'B5 B5 C6 D6 D6 C6 B5 A5 G5 G5 A5 B5 B5:q. A5:e A5:h';
    const p2 = 'B5 B5 C6 D6 D6 C6 B5 A5 G5 G5 A5 B5 A5:q. G5:e G5:h';
    const p3 = 'A5 A5 B5 G5 A5 B5:e C6:e B5 G5 A5 B5:e C6:e B5 A5 G5 A5 D5:h';
    const now = Date.now();
    return {
      id: uid(), title: 'Himno de la Alegría (Beethoven)', tempo: 120, timeSig: '4/4',
      notes: parseMelody([p1, p2, p3, p2].join(' ')), created: now, updated: now,
    };
  }

  function emptyScore() {
    const now = Date.now();
    return { id: uid(), title: 'Nueva partitura', tempo: 100, timeSig: '4/4', notes: [], created: now, updated: now };
  }

  /* ---------- estado ---------- */

  const settings = Object.assign({ naming: 'solfege', acc: 'sharp', method: 'stick', octave: true }, load(LS_SETTINGS, {}));
  let scores = load(LS_SCORES, null);
  if (!Array.isArray(scores) || !scores.length) scores = [demoScore()];
  let current = scores.find(s => s.id === load(LS_CURRENT, null)) || scores[0];
  let cursor = current.notes.length;     // posición de inserción
  let explicit = false;                  // ¿el usuario ha seleccionado una nota a mano?
  let inputDur = 'q', inputDot = false;
  let hits = [];
  let playback = null, playIndex = -1;
  const history = {};                    // id → { undo: [], redo: [] }

  function hist() { return history[current.id] || (history[current.id] = { undo: [], redo: [] }); }
  function snapshot() {
    const h = hist();
    h.undo.push(JSON.stringify({ notes: current.notes, cursor }));
    if (h.undo.length > 200) h.undo.shift();
    h.redo.length = 0;
  }
  function restore(from, to) {
    const h = hist();
    if (!h[from].length) return;
    h[to].push(JSON.stringify({ notes: current.notes, cursor }));
    const s = JSON.parse(h[from].pop());
    current.notes = s.notes;
    cursor = Math.min(s.cursor, current.notes.length);
    explicit = false;
    commit();
  }

  function persist() {
    current.updated = Date.now();
    save(LS_SCORES, scores);
    save(LS_CURRENT, current.id);
  }

  function commit() { persist(); refresh(); }

  /* ---------- render ---------- */

  const canvas = $('#scoreCanvas');
  const wrap = $('#scoreWrap');

  function renderScore() {
    const width = Math.max(300, Math.floor(wrap.clientWidth));
    hits = ScoreRender.renderScreen(canvas, current, settings, width, {
      cursor: explicit || playback ? cursor : (current.notes.length ? cursor : -1),
      playIndex,
      showCursor: true,
    });
  }

  function selected() { return cursor > 0 ? current.notes[cursor - 1] : null; }

  function refresh() {
    renderScore();
    renderLibrary();
    renderSelInfo();
    syncControls();
  }

  function syncControls() {
    const t = $('#title');
    if (document.activeElement !== t && t.value !== current.title) t.value = current.title;
    if (document.activeElement !== $('#tempo')) $('#tempo').value = current.tempo;
    $('#timeSig').value = current.timeSig;
    $$('.seg').forEach(seg => {
      const key = seg.dataset.setting;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', settings[key] === b.dataset.value));
    });
    $('#showOctave').checked = !!settings.octave;
    $$('.dur[data-dur]').forEach(b => b.classList.toggle('on', b.dataset.dur === inputDur));
    $('#dotBtn').classList.toggle('on', inputDot);
    $('#undoBtn').disabled = !hist().undo.length;
    $('#redoBtn').disabled = !hist().redo.length;
    $('#delBtn').disabled = cursor === 0;
    $('#playBtn').classList.toggle('playing', !!playback);
    $('.play-ico').textContent = playback ? '■' : '▶';
    $('.play-txt').textContent = playback ? 'Parar' : 'Reproducir';
    renderPianoLabels();
  }

  function scrollToCursor() {
    const h = hits.find(x => x.index === cursor - 1);
    if (!h) return;
    const top = h.y, bottom = h.y + h.h;
    if (top < wrap.scrollTop || bottom > wrap.scrollTop + wrap.clientHeight) {
      wrap.scrollTo({ top: Math.max(0, top - 20), behavior: 'smooth' });
    }
  }

  /* ---------- selección ---------- */

  function renderSelInfo() {
    const box = $('#selInfo');
    const el = explicit ? selected() : null;
    box.innerHTML = '';
    if (!el) {
      box.innerHTML = '<span class="hint">Toca el piano (o las teclas <kbd>A</kbd>–<kbd>Ñ</kbd>) para añadir notas. ' +
        'Pulsa una nota de la partitura para seleccionarla, cambiar su duración o su combinación de botones.</span>';
      return;
    }
    const lab = document.createElement('span');
    lab.className = 'sel-label';
    const durTxt = OOT.DURATIONS[el.dur] ? OOT.DURATIONS[el.dur].label.toLowerCase() + (el.dot ? ' con puntillo' : '') : '';
    if (el.type === 'note') {
      lab.innerHTML = `Seleccionada: <b>${OOT.noteName(el.midi, settings)}</b> · ${durTxt}`;
      box.appendChild(lab);
      const opts = OOT.options(el.midi);
      if (opts.length > 1) {
        const chosen = OOT.chosenOption(el, settings.method);
        const g = document.createElement('span');
        g.className = 'alts';
        g.appendChild(Object.assign(document.createElement('span'), { className: 'mini-label', textContent: 'Tocar con:' }));
        opts.forEach((o, i) => {
          const b = document.createElement('button');
          b.className = 'alt' + (o === chosen ? ' on' : '');
          b.innerHTML = comboHTML(o);
          b.title = OOT.comboLabel(o);
          b.addEventListener('click', () => { snapshot(); el.alt = i; commit(); });
          g.appendChild(b);
        });
        box.appendChild(g);
      } else {
        const c = document.createElement('span');
        c.className = 'alts';
        c.innerHTML = '<span class="mini-label">Botones:</span>' + comboHTML(opts[0]);
        box.appendChild(c);
      }
    } else if (el.type === 'rest') {
      lab.innerHTML = `Seleccionado: <b>silencio</b> · ${durTxt}`;
      box.appendChild(lab);
    } else {
      lab.innerHTML = 'Seleccionada: <b>barra de compás</b>';
      box.appendChild(lab);
    }
    const desel = document.createElement('button');
    desel.className = 'btn small ghost';
    desel.textContent = 'Ir al final';
    desel.addEventListener('click', () => { cursor = current.notes.length; explicit = false; refresh(); });
    box.appendChild(desel);
  }

  function comboHTML(opt) {
    if (!opt) return '';
    const b = `<span class="kbtn k-${opt[0]}">${opt[0]}</span>`;
    if (!opt[1]) return `<span class="combo">${b}</span>`;
    const kind = opt[1][0] === 'S' ? 'stick' : 'dpad';
    const dir = opt[1][1] === '+' ? 'up' : 'down';
    return `<span class="combo">${b}<span class="kmod ${kind} ${dir}" title="${OOT.MOD_LABEL[opt[1]]}">${OOT.MOD_TEXT[opt[1]]}</span></span>`;
  }

  /* ---------- edición ---------- */

  function insert(el) {
    stopPlayback();
    snapshot();
    current.notes.splice(cursor, 0, el);
    cursor++;
    explicit = false;
    commit();
    scrollToCursor();
  }

  function addNote(midi) {
    if (!OOT.inRange(midi)) { toast('Fuera del rango de la ocarina'); return; }
    insert({ type: 'note', midi, dur: inputDur, dot: inputDot });
  }

  function addRest() { insert({ type: 'rest', dur: inputDur, dot: inputDot }); }
  function addBar() { insert({ type: 'bar' }); }

  function deleteSel() {
    if (cursor === 0) return;
    stopPlayback();
    snapshot();
    current.notes.splice(cursor - 1, 1);
    cursor--;
    explicit = cursor > 0 && explicit;
    commit();
  }

  function setDur(d) {
    inputDur = d;
    const el = explicit ? selected() : null;
    if (el && (el.type === 'note' || el.type === 'rest')) { snapshot(); el.dur = d; commit(); }
    else syncControls();
  }

  function toggleDot() {
    inputDot = !inputDot;
    const el = explicit ? selected() : null;
    if (el && (el.type === 'note' || el.type === 'rest')) { snapshot(); el.dot = inputDot; commit(); }
    else syncControls();
  }

  function transpose(n) {
    const notes = current.notes.filter(e => e.type === 'note');
    if (!notes.length) return;
    if (notes.some(e => !OOT.inRange(e.midi + n))) {
      toast(`No cabe: la ocarina solo llega de ${OOT.noteName(OOT.MIN, settings)} a ${OOT.noteName(OOT.MAX, settings)}`);
      return;
    }
    snapshot();
    notes.forEach(e => { e.midi += n; delete e.alt; });
    commit();
  }

  function moveCursor(d) {
    cursor = Math.max(0, Math.min(current.notes.length, cursor + d));
    explicit = cursor > 0;
    const el = selected();
    if (el && el.type === 'note') blip(el.midi);
    refresh();
    scrollToCursor();
  }

  function blip(midi) {
    const v = Synth.start(midi);
    setTimeout(() => v.stop(), 220);
  }

  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const h = hits.find(h => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
    if (h) {
      cursor = h.index + 1;
      explicit = true;
      const el = current.notes[h.index];
      if (el.type === 'note') blip(el.midi);
      if (el.dur) { inputDur = el.dur; inputDot = !!el.dot; }
    } else {
      cursor = current.notes.length;
      explicit = false;
    }
    refresh();
  });

  /* ---------- reproducción ---------- */

  function play() {
    if (playback) { stopPlayback(); return; }
    if (!current.notes.length) { toast('La partitura está vacía'); return; }
    if (!Synth.ensure()) { toast('Tu navegador no admite audio'); return; }
    const spb = 60 / current.tempo;
    const t0 = Synth.now() + 0.12;
    let t = t0;
    const start = explicit && cursor > 0 ? cursor - 1 : 0;
    const timers = [];
    const savedCursor = cursor, savedExplicit = explicit;
    for (let i = start; i < current.notes.length; i++) {
      const el = current.notes[i];
      if (el.type === 'bar') continue;
      const d = OOT.beats(el) * spb;
      if (el.type === 'note') Synth.schedule(el.midi, t, Math.max(0.05, d * 0.9));
      const idx = i;
      timers.push(setTimeout(() => { playIndex = idx; renderScore(); followPlay(idx); }, (t - Synth.now()) * 1000));
      t += d;
    }
    timers.push(setTimeout(() => stopPlayback(), (t - Synth.now()) * 1000 + 150));
    playback = { timers, savedCursor, savedExplicit };
    syncControls();
  }

  function followPlay(idx) {
    const h = hits.find(x => x.index === idx);
    if (!h) return;
    if (h.y < wrap.scrollTop || h.y + h.h > wrap.scrollTop + wrap.clientHeight) wrap.scrollTo({ top: h.y - 10, behavior: 'smooth' });
  }

  function stopPlayback() {
    if (!playback) return;
    playback.timers.forEach(clearTimeout);
    Synth.stopAll();
    playback = null;
    playIndex = -1;
    renderScore();
    syncControls();
  }

  /* ---------- piano ---------- */

  const KEYMAP = {
    KeyA: 72, KeyW: 73, KeyS: 74, KeyE: 75, KeyD: 76, KeyF: 77, KeyT: 78, KeyG: 79, KeyY: 80,
    KeyH: 81, KeyU: 82, KeyJ: 83, KeyK: 84, KeyO: 85, KeyL: 86, KeyP: 87, Semicolon: 88,
  };
  const KEYLABEL = {};
  Object.entries(KEYMAP).forEach(([code, m]) => { KEYLABEL[m] = code === 'Semicolon' ? 'Ñ' : code.slice(3); });

  const piano = $('#piano');
  const keyEls = {};

  function buildPiano() {
    const whites = [];
    for (let m = OOT.MIN; m <= OOT.MAX; m++) if (!OOT.isBlack(m)) whites.push(m);
    const ww = 100 / whites.length;
    whites.forEach((m, i) => {
      const k = document.createElement('button');
      k.className = 'key white';
      k.style.left = (i * ww) + '%';
      k.style.width = ww + '%';
      k.dataset.midi = m;
      piano.appendChild(k);
      keyEls[m] = k;
    });
    for (let m = OOT.MIN; m <= OOT.MAX; m++) {
      if (!OOT.isBlack(m)) continue;
      const wi = whites.indexOf(m - 1);
      const k = document.createElement('button');
      k.className = 'key black';
      k.style.left = ((wi + 1) * ww - ww * 0.32) + '%';
      k.style.width = (ww * 0.64) + '%';
      k.dataset.midi = m;
      piano.appendChild(k);
      keyEls[m] = k;
    }
    piano.addEventListener('pointerdown', e => {
      const k = e.target.closest('.key');
      if (!k) return;
      e.preventDefault();
      const m = +k.dataset.midi;
      press(m, 'ptr' + e.pointerId);
      addNote(m);
      const up = () => { release('ptr' + e.pointerId); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  const held = {};
  function press(m, id) {
    release(id);
    held[id] = { m, v: Synth.start(m) };
    keyEls[m] && keyEls[m].classList.add('down');
  }
  function release(id) {
    const h = held[id];
    if (!h) return;
    h.v.stop();
    delete held[id];
    if (!Object.values(held).some(x => x.m === h.m)) keyEls[h.m] && keyEls[h.m].classList.remove('down');
  }

  let pianoLabelKey = '';
  function renderPianoLabels() {
    const key = settings.naming + settings.acc + settings.method + settings.octave;
    if (key === pianoLabelKey) return;
    pianoLabelKey = key;
    Object.entries(keyEls).forEach(([m, k]) => {
      m = +m;
      const opt = OOT.chosenOption({ midi: m }, settings.method);
      k.innerHTML = `<span class="k-combo">${comboHTML(opt)}</span><span class="k-name">${OOT.noteName(m, settings)}</span><kbd class="k-kbd">${KEYLABEL[m]}</kbd>`;
      k.title = `${OOT.noteName(m, settings)} → ${OOT.comboLabel(opt)} (tecla ${KEYLABEL[m]})`;
    });
  }

  /* ---------- teclado del ordenador ---------- */

  window.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? restore('redo', 'undo') : restore('undo', 'redo'); return; }
    if (mod && e.code === 'KeyY') { e.preventDefault(); restore('redo', 'undo'); return; }
    if (mod || e.altKey) return;

    if (KEYMAP[e.code] !== undefined) {
      e.preventDefault();
      if (e.repeat) return;
      press(KEYMAP[e.code], e.code);
      addNote(KEYMAP[e.code]);
      return;
    }
    const durKeys = { Digit1: 'w', Digit2: 'h', Digit3: 'q', Digit4: 'e', Digit5: 's', Numpad1: 'w', Numpad2: 'h', Numpad3: 'q', Numpad4: 'e', Numpad5: 's' };
    if (durKeys[e.code]) { e.preventDefault(); setDur(durKeys[e.code]); return; }
    switch (e.code) {
      case 'Period': case 'NumpadDecimal': e.preventDefault(); toggleDot(); break;
      case 'KeyR': case 'Digit0': e.preventDefault(); addRest(); break;
      case 'KeyB': e.preventDefault(); addBar(); break;
      case 'Backspace': case 'Delete': e.preventDefault(); deleteSel(); break;
      case 'ArrowLeft': e.preventDefault(); moveCursor(-1); break;
      case 'ArrowRight': e.preventDefault(); moveCursor(1); break;
      case 'Home': e.preventDefault(); cursor = 0; explicit = false; refresh(); break;
      case 'End': case 'Escape': e.preventDefault(); cursor = current.notes.length; explicit = false; refresh(); break;
      case 'Space': e.preventDefault(); play(); break;
    }
  });
  window.addEventListener('keyup', e => { if (KEYMAP[e.code] !== undefined) release(e.code); });
  window.addEventListener('blur', () => Object.keys(held).forEach(release));

  /* ---------- MIDI ---------- */

  async function connectMidi() {
    if (!navigator.requestMIDIAccess) { toast('Este navegador no admite teclados MIDI (prueba Chrome o Edge)'); return; }
    try {
      const access = await navigator.requestMIDIAccess();
      let count = 0;
      const bind = input => {
        input.onmidimessage = ev => {
          const [st, note, vel] = ev.data;
          const cmd = st & 0xf0;
          const id = 'midi' + note;
          if (cmd === 0x90 && vel > 0) { const m = OOT.fold(note); press(m, id); addNote(m); }
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) release(id);
        };
      };
      access.inputs.forEach(i => { bind(i); count++; });
      access.onstatechange = ev => { if (ev.port.type === 'input' && ev.port.state === 'connected') bind(ev.port); };
      toast(count ? `Teclado MIDI conectado (${count}). Las notas fuera de rango se ajustan de octava.` : 'No se encontró ningún teclado MIDI');
      $('#midiBtn').classList.toggle('on', count > 0);
    } catch (err) { toast('No se pudo acceder al MIDI'); }
  }

  /* ---------- biblioteca ---------- */

  function renderLibrary() {
    const ul = $('#scoreList');
    ul.innerHTML = '';
    [...scores].sort((a, b) => b.updated - a.updated).forEach(s => {
      const li = document.createElement('li');
      li.className = 'score-item' + (s.id === current.id ? ' active' : '');
      const n = s.notes.filter(e => e.type === 'note').length;
      const d = new Date(s.updated);
      li.innerHTML = `<button class="open"><span class="s-title"></span><span class="s-meta">${n} notas · ${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span></button>
        <button class="icon-btn dup" title="Duplicar">⧉</button><button class="icon-btn del" title="Borrar">🗑</button>`;
      li.querySelector('.s-title').textContent = s.title || 'Sin título';
      li.querySelector('.open').addEventListener('click', () => openScore(s.id));
      li.querySelector('.dup').addEventListener('click', () => {
        const c = JSON.parse(JSON.stringify(s));
        c.id = uid(); c.title = (s.title || 'Sin título') + ' (copia)'; c.created = c.updated = Date.now();
        scores.push(c); openScore(c.id);
      });
      li.querySelector('.del').addEventListener('click', ev => {
        const btn = ev.currentTarget;
        if (!btn.classList.contains('confirm')) {
          btn.classList.add('confirm');
          btn.textContent = '¿Borrar?';
          btn.title = 'Pulsa otra vez para borrar';
          setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = '🗑'; btn.title = 'Borrar'; }, 3000);
          return;
        }
        scores = scores.filter(x => x.id !== s.id);
        if (!scores.length) scores.push(emptyScore());
        if (s.id === current.id) openScore(scores[0].id); else { persist(); renderLibrary(); }
      });
      ul.appendChild(li);
    });
  }

  function openScore(id) {
    stopPlayback();
    current = scores.find(s => s.id === id) || scores[0];
    cursor = current.notes.length;
    explicit = false;
    persist();
    wrap.scrollTop = 0;
    refresh();
    closeLibrary();
  }

  const lib = $('#library'), scrim = $('#libScrim');
  function closeLibrary() { lib.classList.remove('open'); scrim.hidden = true; }
  $('#toggleLibrary').addEventListener('click', () => {
    const open = !lib.classList.contains('open');
    lib.classList.toggle('open', open);
    scrim.hidden = !open;
  });
  scrim.addEventListener('click', closeLibrary);

  $('#newScore').addEventListener('click', () => {
    const s = emptyScore();
    scores.push(s);
    openScore(s.id);
    $('#title').focus();
    $('#title').select();
  });

  $('#exportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'oot-ocarina-composer', version: 1, scores }, null, 2)], { type: 'application/json' });
    download(blob, 'partituras-ocarina.json');
  });

  $('#importJson').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : Array.isArray(data.scores) ? data.scores : [data];
      let added = 0;
      list.forEach(s => {
        if (!s || !Array.isArray(s.notes)) return;
        const notes = s.notes.filter(n => n && (n.type === 'bar' ||
          (n.type === 'rest' && OOT.DURATIONS[n.dur]) ||
          (n.type === 'note' && OOT.inRange(n.midi) && OOT.DURATIONS[n.dur])));
        const clean = {
          id: uid(), title: String(s.title || 'Importada').slice(0, 80),
          tempo: Math.min(300, Math.max(30, +s.tempo || 100)),
          timeSig: OOT.measureBeats(s.timeSig) !== null || s.timeSig === 'free' ? s.timeSig : '4/4',
          notes, created: Date.now(), updated: Date.now(),
        };
        scores.push(clean); added++;
      });
      if (!added) throw new Error('vacío');
      persist();
      openScore(scores[scores.length - 1].id);
      toast(`${added} partitura(s) importada(s)`);
    } catch (err) { toast('El archivo no es una copia válida'); }
  });

  /* ---------- controles ---------- */

  $('#title').addEventListener('input', e => { current.title = e.target.value; persist(); renderScore(); renderLibrary(); });
  $('#tempo').addEventListener('change', e => {
    const v = Math.round(+e.target.value);
    current.tempo = Math.min(300, Math.max(30, v || 100));
    e.target.value = current.tempo;
    commit();
  });
  $('#timeSig').addEventListener('change', e => { current.timeSig = e.target.value; commit(); });

  $$('.seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[seg.dataset.setting] = b.dataset.value;
    save(LS_SETTINGS, settings);
    refresh();
  }));
  $('#showOctave').addEventListener('change', e => { settings.octave = e.target.checked; save(LS_SETTINGS, settings); refresh(); });

  $$('.dur[data-dur]').forEach(b => b.addEventListener('click', () => setDur(b.dataset.dur)));
  $('#dotBtn').addEventListener('click', toggleDot);
  $('#restBtn').addEventListener('click', addRest);
  $('#barBtn').addEventListener('click', addBar);
  $('#delBtn').addEventListener('click', deleteSel);
  $('#undoBtn').addEventListener('click', () => restore('undo', 'redo'));
  $('#redoBtn').addEventListener('click', () => restore('redo', 'undo'));
  $$('[data-tr]').forEach(b => b.addEventListener('click', () => transpose(+b.dataset.tr)));
  $('#midiBtn').addEventListener('click', connectMidi);
  $('#playBtn').addEventListener('click', play);

  /* ---------- exportar ---------- */

  function fileName(ext) {
    const base = (current.title || 'partitura').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'partitura';
    return `${base}.${ext}`;
  }

  let downloadsCap;
  if (window.claude && typeof window.claude.use === 'function') {
    downloadsCap = window.claude.use('downloads').catch(() => null);
  }

  /** Descarga un archivo. Dentro de claude.ai usa la capacidad de descargas; si no, un enlace normal. */
  async function download(blob, name) {
    const cap = downloadsCap ? await downloadsCap : null;
    if (cap) {
      try { await cap.save({ filename: name, data: blob }); return true; }
      catch (err) {
        if (err && err.code === 'declined') toast('Descarga cancelada');
        else if (err && err.code === 'rate_limited') toast('Ya hay una descarga pendiente, espera un momento');
        else toast('No se pudo descargar el archivo aquí');
        return false;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }

  async function fontsReady() {
    try {
      await Promise.all([
        document.fonts.load('48px "Noto Music"', '\u{1D11E}'),
        document.fonts.load('700 30px "Cinzel"'),
        document.fonts.load('700 15px "Inter"'),
      ]);
      await document.fonts.ready;
    } catch (e) { /* sin fuentes web: se usan las del sistema */ }
  }

  $('#pdfBtn').addEventListener('click', async () => {
    await fontsReady();
    const pages = ScoreRender.renderPages(current, settings, 2);
    if (await download(MiniPDF.fromCanvases(pages, current.title), fileName('pdf'))) {
      toast(`PDF listo (${pages.length} página${pages.length > 1 ? 's' : ''})`);
    }
  });

  $('#pngBtn').addEventListener('click', async () => {
    await fontsReady();
    const c = ScoreRender.renderImage(current, settings, 2);
    c.toBlob(async b => { if (await download(b, fileName('png'))) toast('Imagen lista'); }, 'image/png');
  });

  $('#txtBtn').addEventListener('click', async () => {
    const txt = ScoreRender.toText(current, settings);
    try { await navigator.clipboard.writeText(txt); toast('Texto copiado al portapapeles'); }
    catch (e) { if (await download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), fileName('txt'))) toast('Texto descargado'); }
  });

  /* ---------- varios ---------- */

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  let rz;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(renderScore); }).observe(wrap);

  buildPiano();
  persist();
  refresh();
  fontsReady().then(renderScore);
})();
