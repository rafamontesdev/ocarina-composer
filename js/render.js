/*
 * Dibujo de la partitura en <canvas>: pentagrama + nombre de la nota + botones del mando.
 * El mismo código sirve para la pantalla, la imagen PNG y las páginas del PDF.
 */
'use strict';

window.ScoreRender = (function () {
  const S = 12;            // separación entre líneas del pentagrama
  const ROW_H = 226;       // alto de cada sistema
  const STAFF_TOP = 62;    // posición de la primera línea dentro del sistema
  const MUSIC_FONT = '"Noto Music", "Bravura", "Segoe UI Symbol", "Apple Symbols", serif';
  const UI_FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const TITLE_FONT = '"Cinzel", Georgia, "Times New Roman", serif';

  const C = {
    paper: '#fffdf7',
    ink: '#1f1b16',
    staff: '#4a4238',
    soft: '#7a6f60',
    sel: 'rgba(212, 166, 52, 0.25)',
    selLine: '#c99a2e',
    play: 'rgba(46, 160, 110, 0.25)',
    A: '#d34b3a',
    X: '#3463c4',
    Y: '#2a9454',
    L: '#4b4f58',
    R: '#4b4f58',
    dpad: '#d5ccbb',
  };

  /* ---------- estructura ---------- */

  function buildItems(score) {
    const items = [];
    const mb = OOT.measureBeats(score.timeSig);
    const notes = score.notes;
    let acc = 0;
    notes.forEach((el, i) => {
      items.push({ type: el.type, el, index: i });
      if (el.type === 'bar') { acc = 0; return; }
      if (mb) {
        acc += OOT.beats(el);
        if (acc >= mb - 1e-6) {
          acc = 0;
          const next = notes[i + 1];
          if (i < notes.length - 1 && !(next && next.type === 'bar')) {
            items.push({ type: 'bar', auto: true, index: i });
          }
        }
      }
    });
    while (items.length && items[items.length - 1].type === 'bar') items.pop();
    items.push({ type: 'end', auto: true, index: notes.length - 1 });
    return items;
  }

  function baseWidth(it, settings) {
    if (it.type === 'note') {
      const sp = OOT.spell(it.el.midi, settings.acc);
      return 68 + (sp.acc ? 12 : 0) + (it.el.dot ? 8 : 0);
    }
    if (it.type === 'rest') return 54 + (it.el.dot ? 8 : 0);
    if (it.type === 'bar') return 22;
    return 26;
  }

  const isFlex = it => it.type === 'note' || it.type === 'rest';

  function headWidth(first, score) {
    return first && score.timeSig !== 'free' ? 100 : 64;
  }

  function layout(score, settings, width) {
    const items = buildItems(score);
    const measures = [];
    let cur = [];
    items.forEach(it => {
      cur.push(it);
      if (it.type === 'bar' || it.type === 'end') { measures.push(cur); cur = []; }
    });
    if (cur.length) measures.push(cur);

    const rows = [];
    let row = { items: [], first: true };
    let used = 0;
    let avail = width - headWidth(true, score);
    const newRow = () => {
      rows.push(row);
      row = { items: [], first: false };
      used = 0;
      avail = width - headWidth(false, score);
    };

    measures.forEach(m => {
      const mw = m.reduce((a, it) => a + baseWidth(it, settings), 0);
      if (used + mw <= avail) { m.forEach(it => row.items.push(it)); used += mw; return; }
      if (row.items.length) newRow();
      m.forEach(it => {
        const w = baseWidth(it, settings);
        if (used + w > avail && row.items.length) newRow();
        row.items.push(it);
        used += w;
      });
    });
    if (row.items.length || !rows.length) rows.push(row);

    rows.forEach((r, ri) => {
      const hw = headWidth(r.first, score);
      const av = width - hw;
      let flex = 0, fixed = 0;
      r.items.forEach(it => { const w = baseWidth(it, settings); if (isFlex(it)) flex += w; else fixed += w; });
      const last = ri === rows.length - 1;
      let scale = 1;
      if (flex > 0 && (!last || (flex + fixed) / av > 0.72)) scale = Math.max(1, (av - fixed) / flex);
      if (last && scale > 1.6 && (flex + fixed) / av <= 0.72) scale = 1;
      let x = hw;
      r.items.forEach(it => {
        const w = baseWidth(it, settings) * (isFlex(it) ? scale : 1);
        it.x = x; it.w = w; x += w;
      });
      r.head = hw;
      r.end = x;
    });
    return rows;
  }

  /* ---------- glifos ---------- */

  function stepY(top, step) { return top + 4 * S - step * (S / 2); }

  function drawButton(ctx, cx, cy, btn, k) {
    k = k || 1;
    ctx.save();
    if (btn === 'L' || btn === 'R') {
      const w = 32 * k, h = 22 * k, r = 7 * k;
      ctx.fillStyle = C[btn];
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, r);
      ctx.fill();
    } else {
      ctx.fillStyle = C[btn] || C.ink;
      ctx.beginPath();
      ctx.arc(cx, cy, 13 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${15 * k}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn, cx, cy + 1 * k);
    ctx.restore();
  }

  function drawMod(ctx, cx, cy, mod, k) {
    k = k || 1;
    const up = mod[1] === '+';
    ctx.save();
    if (mod[0] === 'S') {
      // stick: círculo oscuro con flecha
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(cx, cy, 11 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      const d = up ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy + d * 7 * k);
      ctx.lineTo(cx - 6 * k, cy + d * 0.5 * k);
      ctx.lineTo(cx - 2.2 * k, cy + d * 0.5 * k);
      ctx.lineTo(cx - 2.2 * k, cy - d * 6 * k);
      ctx.lineTo(cx + 2.2 * k, cy - d * 6 * k);
      ctx.lineTo(cx + 2.2 * k, cy + d * 0.5 * k);
      ctx.lineTo(cx + 6 * k, cy + d * 0.5 * k);
      ctx.closePath();
      ctx.fill();
    } else {
      // cruceta: cruz con el brazo activo resaltado
      const a = 4 * k, L = 11 * k;
      ctx.fillStyle = C.dpad;
      roundRect(ctx, cx - a, cy - L, 2 * a, 2 * L, 2 * k); ctx.fill();
      roundRect(ctx, cx - L, cy - a, 2 * L, 2 * a, 2 * k); ctx.fill();
      ctx.fillStyle = C.ink;
      if (up) roundRect(ctx, cx - a, cy - L, 2 * a, L - a + 1, 2 * k);
      else roundRect(ctx, cx - a, cy + a - 1, 2 * a, L - a + 1, 2 * k);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCombo(ctx, cx, cy, opt, k) {
    k = k || 1;
    if (!opt) return;
    const bw = (opt[0] === 'L' || opt[0] === 'R') ? 32 : 26;
    if (opt[1]) {
      const total = (bw + 5 + 22) * k;
      const bx = cx - total / 2 + (bw * k) / 2;
      drawButton(ctx, bx, cy, opt[0], k);
      drawMod(ctx, cx + total / 2 - 11 * k, cy, opt[1], k);
    } else {
      drawButton(ctx, cx, cy, opt[0], k);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawNoteGlyph(ctx, cx, top, el, settings) {
    const step = OOT.staffStep(el.midi, settings.acc);
    const sp = OOT.spell(el.midi, settings.acc);
    const y = stepY(top, step);
    ctx.save();
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.ink;

    // líneas adicionales
    ctx.lineWidth = 1.4;
    for (let st = 10; st <= step; st += 2) {
      const ly = stepY(top, st);
      ctx.beginPath(); ctx.moveTo(cx - 13, ly); ctx.lineTo(cx + 13, ly); ctx.stroke();
    }
    for (let st = -2; st >= step; st -= 2) {
      const ly = stepY(top, st);
      ctx.beginPath(); ctx.moveTo(cx - 13, ly); ctx.lineTo(cx + 13, ly); ctx.stroke();
    }

    // cabeza
    const hollow = el.dur === 'w' || el.dur === 'h';
    ctx.beginPath();
    ctx.ellipse(cx, y, 7.4, 5.3, -0.35, 0, Math.PI * 2);
    if (hollow) {
      ctx.lineWidth = el.dur === 'w' ? 2.6 : 2;
      ctx.stroke();
    } else ctx.fill();

    // plica (hacia abajo: todas las notas están por encima de la 3ª línea)
    if (el.dur !== 'w') {
      const sx = cx - 6.6;
      const ey = Math.max(y + 3.5 * S, stepY(top, 4));
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx, y + 1); ctx.lineTo(sx, ey); ctx.stroke();
      const flags = el.dur === 'e' ? 1 : el.dur === 's' ? 2 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = ey - f * 9;
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        ctx.bezierCurveTo(sx + 2, fy - 8, sx + 13, fy - 10, sx + 10, fy - 24);
        ctx.bezierCurveTo(sx + 11, fy - 14, sx + 4, fy - 10, sx, fy - 7);
        ctx.closePath();
        ctx.fill();
      }
    }

    // puntillo
    if (el.dot) {
      ctx.beginPath();
      ctx.arc(cx + 13, step % 2 === 0 ? y - S / 2 : y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // alteración
    if (sp.acc) {
      ctx.font = `22px ${MUSIC_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sp.acc === 1 ? '♯' : '♭', cx - 20, sp.acc === 1 ? y : y - 4);
    }
    ctx.restore();
  }

  function drawRestGlyph(ctx, cx, top, el) {
    const mid = stepY(top, 4);
    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.ink;
    let dotX = cx + 10, dotY = mid - S / 2;
    switch (el.dur) {
      case 'w':
        ctx.fillRect(cx - 8, stepY(top, 6), 16, S / 2 + 1);
        dotY = stepY(top, 5) + 2;
        break;
      case 'h':
        ctx.fillRect(cx - 8, mid - S / 2 - 1, 16, S / 2 + 1);
        break;
      case 'q': {
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 3, mid - 18);
        ctx.lineTo(cx + 4, mid - 9);
        ctx.lineTo(cx - 2, mid - 1);
        ctx.lineTo(cx + 4, mid + 7);
        ctx.stroke();
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(cx + 4, mid + 7);
        ctx.quadraticCurveTo(cx - 6, mid + 4, cx - 2, mid + 16);
        ctx.stroke();
        break;
      }
      case 'e':
      case 's': {
        const n = el.dur === 'e' ? 1 : 2;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx + 5, mid - 8);
        ctx.lineTo(cx - 2, mid + 14 + (n - 1) * 8);
        ctx.stroke();
        for (let i = 0; i < n; i++) {
          const oy = i * 9;
          const ox = -i * 3;
          ctx.beginPath();
          ctx.arc(cx - 4 + ox, mid - 6 + oy, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(cx - 4 + ox, mid - 4 + oy);
          ctx.quadraticCurveTo(cx + 1 + ox, mid - 3 + oy, cx + 5 + ox, mid - 8 + oy);
          ctx.stroke();
        }
        break;
      }
    }
    if (el.dot) { ctx.beginPath(); ctx.arc(dotX, dotY, 2.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawClef(ctx, x, top) {
    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.font = `${S * 5.6}px ${MUSIC_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('\u{1D11E}', x, stepY(top, 2));
    ctx.restore();
  }

  function drawTimeSig(ctx, x, top, ts) {
    if (ts === 'free') return;
    const [a, b] = ts.split('/');
    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.font = `800 ${S * 2.1}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a, x, stepY(top, 6) + 1);
    ctx.fillText(b, x, stepY(top, 2) + 1);
    ctx.restore();
  }

  /* ---------- cabecera ---------- */

  function legendEntries() {
    return [
      { mod: 'S+', text: 'Stick izq. arriba: +1 tono' },
      { mod: 'S-', text: 'Stick izq. abajo: −1 tono' },
      { mod: 'D+', text: 'Cruceta arriba: +½ tono' },
      { mod: 'D-', text: 'Cruceta abajo: −½ tono' },
    ];
  }

  function drawHeader(ctx, score, settings, ox, w, y) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.ink;
    const titleSize = w < 520 ? 22 : 30;
    ctx.font = `700 ${titleSize}px ${TITLE_FONT}`;
    ctx.fillText(score.title || 'Sin título', ox + w / 2, y + titleSize + 6, w);
    let yy = y + titleSize + 34;
    ctx.fillStyle = C.soft;
    ctx.font = `14px ${UI_FONT}`;
    const ts = score.timeSig === 'free' ? 'compás libre' : score.timeSig;
    const range = OOT.noteName(OOT.MIN, settings) + '–' + OOT.noteName(OOT.MAX, settings);
    ctx.fillText(`Tempo ${score.tempo}  ·  ${ts}  ·  Ocarina · Switch 2  ·  rango ${range}`, ox + w / 2, yy, w);

    // leyenda
    yy += 30;
    ctx.font = `13px ${UI_FONT}`;
    const entries = legendEntries().map(e => ({ ...e, w: 30 + ctx.measureText(e.text).width + 22 }));
    const lines = [[]];
    let lw = 0;
    entries.forEach(e => {
      if (lw + e.w > w && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(e); lw += e.w;
    });
    lines.forEach(line => {
      const total = line.reduce((a, e) => a + e.w, 0) - 22;
      let x = ox + (w - total) / 2;
      line.forEach(e => {
        drawMod(ctx, x + 11, yy, e.mod, 0.85);
        ctx.fillStyle = C.soft;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.text, x + 28, yy + 1);
        x += e.w;
      });
      yy += 28;
    });
    ctx.restore();
    return yy - y + 6;
  }

  function headerHeight(score, settings, w) {
    const c = document.createElement('canvas').getContext('2d');
    return drawHeader(c, score, settings, 0, w, 0);
  }

  /* ---------- sistemas ---------- */

  function drawRow(ctx, r, ox, y0, score, settings, st, hits) {
    const top = y0 + STAFF_TOP;
    const bottom = top + 4 * S;

    // resaltados
    r.items.forEach(it => {
      if (it.auto || it.type === 'end') return;
      const isSel = st.cursor - 1 === it.index && st.cursor > 0;
      const isPlay = st.playIndex === it.index;
      if (isSel || isPlay) {
        ctx.fillStyle = isPlay ? C.play : C.sel;
        roundRect(ctx, ox + it.x + 2, y0 + 10, it.w - 4, ROW_H - 22, 10);
        ctx.fill();
      }
      if (hits) hits.push({ index: it.index, x: ox + it.x, y: y0, w: it.w, h: ROW_H });
    });

    // cursor al inicio
    if (st.showCursor && st.cursor === 0 && r.first) {
      const first = r.items[0];
      ctx.fillStyle = C.selLine;
      ctx.fillRect(ox + first.x, y0 + 12, 3, ROW_H - 26);
    }

    // pentagrama
    ctx.strokeStyle = C.staff;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
      const ly = top + i * S;
      ctx.beginPath(); ctx.moveTo(ox, ly); ctx.lineTo(ox + r.end, ly); ctx.stroke();
    }
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ox, top); ctx.lineTo(ox, bottom); ctx.stroke();

    drawClef(ctx, ox + 6, top);
    if (r.first) drawTimeSig(ctx, ox + 74, top, score.timeSig);

    const nameY = bottom + 52;
    const comboY = bottom + 98;

    r.items.forEach(it => {
      const cx = ox + it.x + it.w / 2;
      if (it.type === 'note') {
        const sp = OOT.spell(it.el.midi, settings.acc);
        const ncx = cx + (sp.acc ? 5 : 0) - (it.el.dot ? 3 : 0);
        drawNoteGlyph(ctx, ncx, top, it.el, settings);
        ctx.fillStyle = C.ink;
        ctx.font = `700 15px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(OOT.noteName(it.el.midi, settings), cx, nameY, it.w - 4);
        drawCombo(ctx, cx, comboY, OOT.chosenOption(it.el, settings.method), 1);
      } else if (it.type === 'rest') {
        drawRestGlyph(ctx, cx, top, it.el);
        ctx.fillStyle = C.soft;
        ctx.font = `600 13px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('silencio', cx, nameY, it.w - 4);
        ctx.fillText('—', cx, comboY);
      } else if (it.type === 'bar') {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
        ctx.strokeStyle = 'rgba(74,66,56,.18)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(cx, bottom + 24); ctx.lineTo(cx, comboY + 18); ctx.stroke();
        ctx.setLineDash([]);
      } else if (it.type === 'end') {
        const ex = ox + it.x + it.w;
        ctx.fillStyle = C.ink;
        ctx.fillRect(ex - 5, top, 5, 4 * S);
        ctx.fillRect(ex - 11, top, 1.5, 4 * S);
      }
    });

    if (!score.notes.length && r.first) {
      ctx.fillStyle = C.soft;
      ctx.font = `italic 15px ${UI_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Toca el piano para empezar a componer…', ox + r.head + 30, nameY);
    }
  }

  /* ---------- salida ---------- */

  function prepCanvas(canvas, w, h, dpr) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);
    return ctx;
  }

  /** Dibuja la partitura completa en un canvas de pantalla. Devuelve las zonas clicables. */
  function renderScreen(canvas, score, settings, width, st) {
    const pad = width < 520 ? 14 : 34;
    const inner = width - pad * 2;
    const rows = layout(score, settings, inner);
    const hh = headerHeight(score, settings, inner);
    const h = pad + hh + rows.length * ROW_H + pad;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = width + 'px';
    canvas.style.height = h + 'px';
    const ctx = prepCanvas(canvas, width, h, dpr);
    drawHeader(ctx, score, settings, pad, inner, pad);
    const hits = [];
    rows.forEach((r, i) => drawRow(ctx, r, pad, pad + hh + i * ROW_H, score, settings, st, hits));
    return hits;
  }

  const PAGE_W = 1240, PAGE_H = 1754, MARGIN = 80;

  /** Páginas A4 (150 ppp × escala) para el PDF. */
  function renderPages(score, settings, scale) {
    scale = scale || 2;
    const inner = PAGE_W - MARGIN * 2;
    const rows = layout(score, settings, inner);
    const hh = headerHeight(score, settings, inner);
    const usable = PAGE_H - MARGIN * 2 - 30;
    const pages = [];
    let page = [], y = hh;
    rows.forEach(r => {
      if (y + ROW_H > usable && page.length) { pages.push({ rows: page, header: !pages.length }); page = []; y = 0; }
      page.push(r); y += ROW_H;
    });
    pages.push({ rows: page, header: !pages.length });

    const st = { cursor: -1, playIndex: -1 };
    return pages.map((p, pi) => {
      const canvas = document.createElement('canvas');
      const ctx = prepCanvas(canvas, PAGE_W, PAGE_H, scale);
      let yy = MARGIN;
      if (p.header) yy += drawHeader(ctx, score, settings, MARGIN, inner, MARGIN);
      p.rows.forEach(r => { drawRow(ctx, r, MARGIN, yy, score, settings, st, null); yy += ROW_H; });
      ctx.fillStyle = C.soft;
      ctx.font = `12px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${score.title || 'Sin título'} — página ${pi + 1} de ${pages.length}`, PAGE_W / 2, PAGE_H - MARGIN / 2);
      return canvas;
    });
  }

  /** Una sola imagen larga con toda la partitura. */
  function renderImage(score, settings, scale) {
    scale = scale || 2;
    const W = PAGE_W, pad = 60;
    const inner = W - pad * 2;
    const rows = layout(score, settings, inner);
    const hh = headerHeight(score, settings, inner);
    const h = pad + hh + rows.length * ROW_H + pad;
    const canvas = document.createElement('canvas');
    const ctx = prepCanvas(canvas, W, h, scale);
    drawHeader(ctx, score, settings, pad, inner, pad);
    const st = { cursor: -1, playIndex: -1 };
    rows.forEach((r, i) => drawRow(ctx, r, pad, pad + hh + i * ROW_H, score, settings, st, null));
    return canvas;
  }

  /** Versión en texto, al estilo del repositorio de referencia. */
  function toText(score, settings) {
    const items = buildItems(score);
    const measures = [];
    let cur = [];
    items.forEach(it => {
      if (it.type === 'bar' || it.type === 'end') { if (cur.length) measures.push(cur); cur = []; }
      else cur.push(it);
    });
    if (cur.length) measures.push(cur);

    const ts = score.timeSig === 'free' ? 'compás libre' : score.timeSig;
    const out = [score.title || 'Sin título', `Tempo ${score.tempo} · ${ts}`,
      '⇧/⇩ = stick izquierdo arriba/abajo (±1 tono) · ↑/↓ = cruceta arriba/abajo (±½ tono)', ''];
    const PER_LINE = 4;
    for (let i = 0; i < measures.length; i += PER_LINE) {
      const group = measures.slice(i, i + PER_LINE);
      const nl = [], bl = [];
      group.forEach(m => {
        const n = [], b = [];
        m.forEach(it => {
          let a, c;
          if (it.type === 'note') { a = OOT.noteName(it.el.midi, settings); c = OOT.comboText(OOT.chosenOption(it.el, settings.method)); }
          else { a = '–'; c = '–'; }
          const w = Math.max(a.length, c.length);
          n.push(a.padEnd(w)); b.push(c.padEnd(w));
        });
        nl.push(n.join(' ')); bl.push(b.join(' '));
      });
      const pairs = nl.map((s, k) => { const w = Math.max(s.length, bl[k].length); return [s.padEnd(w), bl[k].padEnd(w)]; });
      out.push('Notas:   ' + pairs.map(p => p[0]).join(' │ ').trimEnd());
      out.push('Botones: ' + pairs.map(p => p[1]).join(' │ ').trimEnd());
      out.push('');
    }
    return out.join('\n');
  }

  return { renderScreen, renderPages, renderImage, toText, drawCombo, colors: C };
})();
