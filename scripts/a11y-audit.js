// Accessibility audit injected into each page by the Ribbonmere 2.0 browser tests (plain JS on purpose).
(() => {
            const out = [];
            const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"], .export-stage'); };
            const nameOf = (el) => {
              const h = el;
              const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
              const by = el.getAttribute('aria-labelledby'); const byText = by ? by.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
              const own = (h.innerText ?? '').trim();
              const img = el.querySelector('img[alt]:not([alt=""]), svg[aria-label]');
              const forLabel = el.labels?.[0]?.textContent ?? '';
              const wrap = el.closest('label')?.textContent ?? '';
              const ph = el.getAttribute('placeholder') ?? '';
              return (label || byText || own || img?.getAttribute('alt') || img?.getAttribute('aria-label') || forLabel || wrap || ph).trim();
            };
            for (const el of Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab]'))) {
              if (!visible(el)) continue;
              if (!nameOf(el)) out.push(`unnamed ${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`);
            }
            const parse = (c) => {
              const sr = c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/); if (sr) return [sr[1] * 255, sr[2] * 255, sr[3] * 255, sr[4] === undefined ? 1 : +sr[4]]; const m2 = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m2 ? [+m2[1], +m2[2], +m2[3], m2[4] === undefined ? 1 : +m2[4]] : null; };
            const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
            const bgOf = (el) => {
              for (let e = el; e; e = e.parentElement) {
                const band = e.querySelector(':scope > .night-band'); // Stargirl's sky sits beside the title, not around it
                if (band) { const cols = (getComputedStyle(band).backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean); if (cols.length) return cols.sort((x, y) => lum(y) - lum(x))[0]; } const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.6) return c; if (getComputedStyle(e).backgroundImage !== 'none' && e !== document.body && e !== document.documentElement) return []; }
              return parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
            };
            const seen = new Set();
            for (const el of Array.from(document.querySelectorAll('main *, nav *, header *'))) {
              if (!visible(el) || el.closest('svg')) continue;
              const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
              if (!text) continue;
              const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el);
              if (!fg || !bg.length || fg[3] < 0.3) continue; // over an image or gradient: not measurable this way
              const op = parseFloat(cs.opacity);
              const L1 = lum(fg); const L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
              const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
              const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
              if (op >= 0.9 && ratio < need) { const key = `${text.slice(0, 24)} ${ratio.toFixed(2)}`; if (!seen.has(key)) { seen.add(key); out.push(`contrast ${ratio.toFixed(2)} < ${need}: “${text.slice(0, 30)}” (${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}) fg=${fg.slice(0, 3).map(Math.round)} bg=${bg.slice(0, 3).map(Math.round)}`); } }
            }
            return out;
          })()
