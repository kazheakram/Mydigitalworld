// Turn an on-screen SVG scene (a scrapbook page, a letter) into a file you can keep.
// Theme colours are CSS variables on the page, so they are written into the copy as real colours;
// images are embedded so the file works on its own. Anything that can't be embedded (an image on
// another site that refuses to share) is left out rather than breaking the export.

async function toDataUrl(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

/** Browsers won't turn HTML-in-SVG (foreignObject) into a PNG, so each block of text is redrawn as
 *  plain SVG text, wrapped and placed where it appears on screen. */
function textify(orig: SVGSVGElement, copy: SVGSVGElement) {
  const origs = Array.from(orig.querySelectorAll('foreignObject'));
  const copies = Array.from(copy.querySelectorAll('foreignObject'));
  const measure = document.createElement('canvas').getContext('2d')!;
  const NS = 'http://www.w3.org/2000/svg';
  origs.forEach((fo, i) => {
    const target = copies[i]; if (!target) return;
    const fx = Number(fo.getAttribute('x') ?? 0); const fy = Number(fo.getAttribute('y') ?? 0); const fw = Number(fo.getAttribute('width') ?? 0);
    const box = fo.getBoundingClientRect(); const scale = box.width / (fw || 1) || 1;
    const group = document.createElementNS(NS, 'g');
    const root = fo.firstElementChild as HTMLElement | null;
    if (!root) { target.remove(); return; }
    const blocks = Array.from(root.querySelectorAll('p')) as HTMLElement[];
    for (const el of blocks.length ? blocks : [root]) {
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize); const lh = parseFloat(cs.lineHeight) || size * 1.35;
      measure.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      const r = el.getBoundingClientRect();
      const left = (r.left - box.left) / scale; const width = r.width / scale; const top = (r.top - box.top) / scale;
      const lines: string[] = [];
      for (const para of (el.innerText || el.textContent || '').split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (line && measure.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
        }
        lines.push(line);
      }
      const align = cs.textAlign === 'right' || cs.textAlign === 'end' ? 'end' : cs.textAlign === 'center' ? 'middle' : 'start';
      const ax = fx + left + (align === 'end' ? width : align === 'middle' ? width / 2 : 0);
      lines.forEach((ln, k) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', String(ax)); t.setAttribute('y', String(fy + top + lh * k + (lh + size * 0.7) / 2));
        t.setAttribute('font-size', String(size)); t.setAttribute('font-family', cs.fontFamily); t.setAttribute('fill', cs.color);
        t.setAttribute('font-style', cs.fontStyle); t.setAttribute('font-weight', cs.fontWeight); t.setAttribute('text-anchor', align);
        t.textContent = ln;
        group.appendChild(t);
      });
    }
    target.replaceWith(group);
  });
}

/** @font-face rules (with the font files embedded) for the families a picture uses, so the
 *  downloaded image keeps its script and handwriting lettering. Latin subsets only, to stay small. */
async function embeddedFonts(families: Set<string>): Promise<string> {
  const wanted = [...families].map((f) => f.replace(/["']/g, '').trim().toLowerCase());
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // another site's stylesheet
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const fam = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim().toLowerCase();
      const range = rule.style.getPropertyValue('unicode-range');
      if (!wanted.includes(fam) || (range && !/U\+0+-0*FF\b/i.test(range))) continue;
      const url = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/)?.[1];
      if (!url) continue;
      const data = await toDataUrl(new URL(url, sheet.href ?? location.href).href);
      if (data) out.push(`@font-face { font-family: "${fam}"; font-style: ${rule.style.getPropertyValue('font-style') || 'normal'}; font-weight: ${rule.style.getPropertyValue('font-weight') || '400'}; src: url(${data}); }`);
    }
  }
  return out.join('\n');
}

/** A standalone SVG string for the given element, with theme colours resolved and images embedded. */
export async function svgSnapshot(svg: SVGSVGElement, width: number, height: number): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
  textify(svg, copy);
  for (const img of Array.from(copy.querySelectorAll('image'))) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href');
    if (!href) continue;
    const data = await toDataUrl(href);
    if (data) img.setAttribute('href', data); else img.remove();
  }
  const style = getComputedStyle(svg);
  const resolve = (s: string) => s.replace(/var\((--[\w-]+)\)/g, (_, name) => style.getPropertyValue(name).trim() || '#000000');
  const font = getComputedStyle(document.body).fontFamily;
  const families = new Set<string>([font.split(',')[0]]);
  for (const t of Array.from(copy.querySelectorAll('[font-family]'))) families.add(resolve(t.getAttribute('font-family')!).split(',')[0]);
  copy.insertAdjacentHTML('afterbegin', `<style>${await embeddedFonts(families)}</style>`);
  // Text without its own font (e.g. map signboards) uses the page's body font.
  for (const t of Array.from(copy.querySelectorAll('text:not([font-family])'))) t.setAttribute('font-family', font);
  return resolve(new XMLSerializer().serializeToString(copy));
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function downloadSvg(svg: SVGSVGElement, width: number, height: number, name: string) {
  save(new Blob([await svgSnapshot(svg, width, height)], { type: 'image/svg+xml' }), `${name}.svg`);
}

/** PNG at up to 2× size. Rejects (so the caller can offer the SVG instead) if the browser refuses. */
export async function downloadPng(svg: SVGSVGElement, width: number, height: number, name: string, scale = 2) {
  const text = await svgSnapshot(svg, width, height);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('The picture could not be drawn.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = width * scale; canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => { try { canvas.toBlob(res, 'image/png'); } catch { res(null); } });
    if (!blob) throw new Error('This browser would not turn the page into a PNG. Try “Download as SVG” instead.');
    save(blob, `${name}.png`);
  } finally { URL.revokeObjectURL(url); }
}
