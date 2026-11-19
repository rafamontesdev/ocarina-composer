/*
 * Generador mínimo de PDF sin dependencias: cada página es una imagen JPEG a tamaño A4.
 */
'use strict';

window.MiniPDF = (function () {
  const A4_W = 595.28, A4_H = 841.89;
  const enc = new TextEncoder();

  function dataUrlToBytes(url) {
    const b64 = url.split(',')[1];
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** canvases: array de <canvas>. Devuelve un Blob application/pdf. */
  function fromCanvases(canvases, title) {
    const chunks = [];
    const offsets = [];
    let length = 0;
    const push = data => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      chunks.push(bytes);
      length += bytes.length;
    };
    const obj = (n, body) => { offsets[n] = length; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };

    const n = canvases.length;
    // 1: catálogo, 2: páginas, 3: info, luego por página: page, contents, image
    const pageId = i => 4 + i * 3;
    const contId = i => 5 + i * 3;
    const imgId = i => 6 + i * 3;
    const total = 3 + n * 3;

    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${canvases.map((_, i) => pageId(i) + ' 0 R').join(' ')}] >>`));
    const safeTitle = String(title || 'Partitura').replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '?');
    obj(3, () => push(`<< /Title (${safeTitle}) /Producer (Compositor de Ocarina) >>`));

    canvases.forEach((c, i) => {
      const jpg = dataUrlToBytes(c.toDataURL('image/jpeg', 0.92));
      const content = `q ${A4_W} 0 0 ${A4_H} 0 0 cm /Im0 Do Q`;
      obj(pageId(i), () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 ${imgId(i)} 0 R >> >> /Contents ${contId(i)} 0 R >>`));
      obj(contId(i), () => { push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`); });
      obj(imgId(i), () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
        push(jpg);
        push('\nendstream');
      });
    });

    const xref = length;
    let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x);
    push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  return { fromCanvases };
})();
