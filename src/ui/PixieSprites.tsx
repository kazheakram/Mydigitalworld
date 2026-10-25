import { useStore } from '../lib/store';

// Little pixel-art sprites for Pixie Mode, drawn from tiny text maps (each character is one pixel).
const PALETTE: Record<string, string> = { r: 'var(--c-rose)', p: 'var(--c-pink)', d: 'var(--c-roseDeep)', w: 'var(--c-trim)', g: 'var(--c-sageDeep)', y: 'var(--c-gold)', k: 'var(--c-ink)', b: 'var(--c-blush)' };
export const SPRITES: Record<string, string[]> = {
  heart: ['.rr.rr.', 'rpprrpr', 'rpprrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  bunny: ['.w...w.', '.wp.pw.', '.wp.pw.', '.wwwww.', 'wkwwwkw', 'wwwpwww', '.wwwww.', 'wwwwwww', 'ww...ww'],
  star: ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y'],
  mushroom: ['..rrr..', '.rwrrr.', 'rrrrwrr', 'rwrrrrr', '..www..', '..www..', '..www..'],
  bow: ['rr...rr', 'rpr.rpr', 'rpprppr', 'rrrdrrr', 'rpr.rpr', 'r.r.r.r', '..r.r..'],
  flower: ['.p.p.', 'ppypp', '.p.p.', '..g..', '.gg..', '..g..'],
};
export function Sprite({ name, size = 4, className = '' }: { name: keyof typeof SPRITES | string; size?: number; className?: string }) {
  const rows = SPRITES[name] ?? SPRITES.heart;
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <svg className={`sprite ${className}`} width={w * size} height={rows.length * size} viewBox={`0 0 ${w} ${rows.length}`} shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c !== '.' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[c] ?? c} /> : null)))}
    </svg>
  );
}

/** Corner sprites that only appear in Pixie Mode. */
export function PixieSprites() {
  const { appearance, motionOff } = useStore();
  if (appearance !== 'pixie') return null;
  return (
    <div className={`pixie-sprites decor-only ${motionOff ? 'still' : ''}`} aria-hidden>
      <span className="ps ps-1"><Sprite name="bunny" /></span>
      <span className="ps ps-2"><Sprite name="heart" /></span>
      <span className="ps ps-3"><Sprite name="star" /></span>
      <span className="ps ps-4"><Sprite name="mushroom" /></span>
    </div>
  );
}

/** An SVG filter that turns the illustrated map into chunky pixels (Pixie Mode). */
export function PixelateFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="rm-pixelate" x="0" y="0" width="100%" height="100%">
        <feFlood x="3" y="3" height="1" width="1" />
        <feComposite width="6" height="6" />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius="3" />
      </filter>
    </svg>
  );
}
