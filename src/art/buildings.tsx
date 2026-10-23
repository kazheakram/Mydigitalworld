import { line, thin, pick, tok, type ArtColors } from './palette';

// Original storybook-style buildings, drawn in a 200×200 box with the ground at y≈192.
// Colours: roof / wall / trim / accent / window can be overridden per building in the Atelier.

type P = { c?: ArtColors };
const roofOf = (c?: ArtColors) => pick(c, 'roof', 'roof');
const wallOf = (c?: ArtColors) => pick(c, 'wall', 'wall');
const trimOf = (c?: ArtColors) => pick(c, 'trim', 'trim');
const accOf = (c?: ArtColors) => pick(c, 'accent', 'rose');
const winOf = (c?: ArtColors) => pick(c, 'window', 'window');

export const Shadow = ({ w = 150, cx = 100 }: { w?: number; cx?: number }) => (
  <ellipse cx={cx} cy={192} rx={w / 2} ry={7} fill="var(--c-ink)" opacity={0.12} />
);

/** A small bow, the village's signature motif. */
export const Bow = ({ x, y, s = 1, fill = tok('rose') }: { x: number; y: number; s?: number; fill?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0 C-10 -9 -16 -2 -14 4 C-12 9 -5 6 0 0 Z" fill={fill} {...thin} />
    <path d="M0 0 C10 -9 16 -2 14 4 C12 9 5 6 0 0 Z" fill={fill} {...thin} />
    <path d="M-1 1 L-6 14 M1 1 L6 14" stroke={fill} strokeWidth={3} strokeLinecap="round" />
    <circle r={3} fill={fill} {...thin} />
  </g>
);

const Window = ({ x, y, w = 22, h = 26, c, arch = false, box = true }: { x: number; y: number; w?: number; h?: number; c?: ArtColors; arch?: boolean; box?: boolean }) => (
  <g>
    {arch
      ? <path d={`M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`} fill={winOf(c)} {...thin} className="glow-window" />
      : <rect x={x} y={y} width={w} height={h} rx={2} fill={winOf(c)} {...thin} className="glow-window" />}
    <path d={`M${x + w / 2} ${y + 2} V${y + h} M${x} ${y + h * 0.55} H${x + w}`} stroke={trimOf(c)} strokeWidth={2} />
    {/* little lace curtains */}
    <path d={`M${x + 1} ${y + 3} q${w / 4} ${h / 3} 0 ${h * 0.5}`} stroke={tok('blush')} strokeWidth={3} fill="none" opacity={0.9} />
    <path d={`M${x + w - 1} ${y + 3} q${-w / 4} ${h / 3} 0 ${h * 0.5}`} stroke={tok('blush')} strokeWidth={3} fill="none" opacity={0.9} />
    {box && (
      <g>
        <rect x={x - 3} y={y + h} width={w + 6} height={6} rx={2} fill={accOf(c)} {...thin} />
        {[0, 1, 2, 3].map((i) => <circle key={i} cx={x + 1 + i * ((w + 2) / 3)} cy={y + h - 1} r={3} fill={i % 2 ? tok('pink') : tok('roseDeep')} />)}
      </g>
    )}
  </g>
);

const Scallops = ({ x, y, w, n, fill }: { x: number; y: number; w: number; n: number; fill: string }) => {
  const s = w / n;
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i++) d += ` a${s / 2} ${s / 2.2} 0 0 0 ${s} 0`;
  return <path d={d + ` V${y - 4} H${x} Z`} fill={fill} {...thin} />;
};

export function Cottage({ c }: P) {
  return (
    <g>
      <Shadow w={160} />
      <rect x={120} y={28} width={16} height={36} fill={tok('cream')} {...line} />
      <rect x={117} y={24} width={22} height={7} rx={2} fill={roofOf(c)} {...line} />
      <path d="M40 95 V188 H160 V95" fill={wallOf(c)} {...line} />
      {/* timber hint */}
      <path d="M40 120 H160" stroke={tok('pink')} strokeWidth={2} opacity={0.6} />
      <path d="M24 100 L100 30 L176 100 Z" fill={roofOf(c)} {...line} />
      <path d="M36 98 L100 40 L164 98" fill="none" stroke={trimOf(c)} strokeWidth={3} strokeDasharray="1 6" strokeLinecap="round" />
      <Scallops x={26} y={104} w={148} n={9} fill={roofOf(c)} />
      <path d="M100 58 c-6 -8 -16 -2 -10 6 l10 10 l10 -10 c6 -8 -4 -14 -10 -6 z" fill={tok('blush')} {...thin} />
      <Window x={52} y={128} c={c} />
      <Window x={126} y={128} c={c} />
      <path d="M84 188 V150 a16 16 0 0 1 32 0 V188 Z" fill={accOf(c)} {...line} />
      <circle cx={110} cy={170} r={2} fill={tok('gold')} />
      <Bow x={100} y={142} s={0.8} fill={tok('trim')} />
      <rect x={80} y={186} width={40} height={5} rx={2} fill={tok('roseDeep')} opacity={0.7} />
    </g>
  );
}

export function Library({ c }: P) {
  return (
    <g>
      <Shadow w={176} />
      <rect x={24} y={182} width={152} height={9} rx={2} fill={tok('cream')} {...line} />
      <rect x={34} y={176} width={132} height={8} rx={2} fill={tok('cream')} {...line} />
      <rect x={36} y={86} width={128} height={90} fill={wallOf(c)} {...line} />
      <path d="M26 88 L100 36 L174 88 Z" fill={roofOf(c)} {...line} />
      <path d="M44 84 L100 46 L156 84 Z" fill={tok('blush')} opacity={0.7} />
      <circle cx={100} cy={70} r={11} fill={winOf(c)} {...thin} className="glow-window" />
      <path d="M100 59 V81 M89 70 H111" stroke={trimOf(c)} strokeWidth={2} />
      <rect x={30} y={86} width={140} height={7} fill={trimOf(c)} {...thin} />
      {[44, 66, 128, 150].map((x) => (
        <g key={x}>
          <rect x={x - 5} y={94} width={10} height={82} fill={trimOf(c)} {...thin} />
          <path d={`M${x - 2} 98 V172 M${x + 2} 98 V172`} stroke={tok('pink')} strokeWidth={1} opacity={0.7} />
        </g>
      ))}
      {/* the great arched window full of book spines */}
      <path d="M78 176 V118 a22 22 0 0 1 44 0 V176 Z" fill={tok('cream')} {...line} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={82 + i * 5.3} y={128 + (i % 3) * 2} width={4.5} height={18 - (i % 3) * 2} fill={[tok('rose'), tok('accent'), tok('gold'), tok('sageDeep')][i % 4]} />
      ))}
      <path d="M80 148 H120" stroke={tok('inkSoft')} strokeWidth={2} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={83 + i * 6} y={152 + (i % 2) * 2} width={5} height={16 - (i % 2) * 2} fill={[tok('roseDeep'), tok('pink'), tok('sage'), tok('gold')][i % 4]} />
      ))}
      <path d="M78 118 a22 22 0 0 1 44 0" fill="none" stroke={roofOf(c)} strokeWidth={4} />
      <Bow x={100} y={38} s={0.9} />
      <path d="M58 94 q42 18 84 0" stroke={tok('rose')} strokeWidth={2} fill="none" strokeDasharray="2 4" />
    </g>
  );
}

export function Townhouse({ c }: P) {
  return (
    <g>
      <Shadow w={120} />
      <rect x={52} y={60} width={96} height={128} fill={wallOf(c)} {...line} />
      <path d="M44 64 L58 26 H142 L156 64 Z" fill={roofOf(c)} {...line} />
      <path d="M100 26 V8" {...line} />
      {/* quill weathervane */}
      <path d="M100 8 q12 -2 18 -10 q-4 10 -18 14 z" fill={tok('cream')} {...thin} />
      <Window x={70} y={34} w={16} h={18} c={c} arch box={false} />
      <Window x={114} y={34} w={16} h={18} c={c} arch box={false} />
      {/* bay window */}
      <path d="M62 82 H138 L132 126 H68 Z" fill={tok('cream')} {...line} />
      <rect x={70} y={88} width={18} height={30} fill={winOf(c)} {...thin} className="glow-window" />
      <rect x={91} y={88} width={18} height={30} fill={winOf(c)} {...thin} className="glow-window" />
      <rect x={112} y={88} width={18} height={30} fill={winOf(c)} {...thin} className="glow-window" />
      <Scallops x={60} y={84} w={80} n={6} fill={accOf(c)} />
      <path d="M86 188 V150 a14 14 0 0 1 28 0 V188 Z" fill={accOf(c)} {...line} />
      {/* inkwell sign */}
      <path d="M140 136 h16" {...line} />
      <rect x={146} y={136} width={18} height={18} rx={3} fill={tok('paper')} {...thin} />
      <path d="M150 150 h10 v-6 a5 5 0 0 0 -10 0 z" fill={tok('ink')} opacity={0.7} />
      <Window x={62} y={140} w={16} h={20} c={c} />
      <Window x={122} y={140} w={16} h={20} c={c} />
    </g>
  );
}

export function Loft({ c }: P) {
  return (
    <g>
      <Shadow w={150} />
      <path d="M36 92 V188 H164 V92" fill={wallOf(c)} {...line} />
      <path d="M28 96 L60 46 H140 L172 96 Z" fill={roofOf(c)} {...line} />
      {/* big round studio window */}
      <circle cx={100} cy={72} r={18} fill={winOf(c)} {...line} className="glow-window" />
      <path d="M100 54 V90 M82 72 H118 M88 60 L112 84 M112 60 L88 84" stroke={trimOf(c)} strokeWidth={1.6} />
      <path d="M50 100 h100" stroke={tok('pink')} strokeWidth={2} strokeDasharray="6 4" />
      <Window x={48} y={116} w={26} h={30} c={c} />
      <Window x={126} y={116} w={26} h={30} c={c} />
      <rect x={82} y={130} width={36} height={58} rx={3} fill={accOf(c)} {...line} />
      <path d="M100 130 V188" stroke={trimOf(c)} strokeWidth={1.6} />
      {/* palette sign */}
      <path d="M140 160 c18 -10 26 6 18 14 c-4 4 -10 0 -12 4 c-2 6 -10 4 -10 -2 c-2 -8 0 -12 4 -16 z" fill={tok('cream')} {...thin} />
      {[[147, 163, 'rose'], [153, 161, 'accent'], [156, 167, 'gold']].map(([x, y, col]) => <circle key={String(x)} cx={Number(x)} cy={Number(y)} r={2.2} fill={tok(String(col))} />)}
      <Bow x={100} y={50} s={0.7} />
    </g>
  );
}

export function Pavilion({ c }: P) {
  return (
    <g>
      <Shadow w={170} />
      <ellipse cx={100} cy={184} rx={78} ry={10} fill={tok('cream')} {...line} />
      {[34, 64, 100, 136, 166].map((x) => <rect key={x} x={x - 4} y={96} width={8} height={86} fill={trimOf(c)} {...thin} />)}
      {/* lattice rail */}
      <path d="M30 150 H170 M30 166 H170" stroke={trimOf(c)} strokeWidth={3} />
      {[40, 52, 76, 88, 112, 124, 148, 160].map((x) => <path key={x} d={`M${x} 150 l6 16 M${x + 6} 150 l-6 16`} stroke={tok('pink')} strokeWidth={1.5} />)}
      <path d="M20 100 Q100 20 180 100 Z" fill={roofOf(c)} {...line} />
      <path d="M44 92 Q100 40 156 92" stroke={tok('blush')} strokeWidth={3} fill="none" opacity={0.8} />
      <Scallops x={22} y={104} w={156} n={10} fill={accOf(c)} />
      <path d="M100 40 V16" {...line} />
      <path d="M100 16 l16 5 l-16 5 z" fill={tok('rose')} {...thin} />
      {/* gramophone */}
      <rect x={88} y={156} width={24} height={14} rx={2} fill={tok('roseDeep')} {...thin} />
      <path d="M100 156 V142 q10 -12 26 -16 q-2 16 -14 22 z" fill={tok('gold')} {...thin} />
      <g className="float-note"><path d="M60 128 v-12 l8 -2 v10" stroke={tok('ink')} strokeWidth={1.6} fill="none" opacity={0.5} /><circle cx={58} cy={128} r={2.5} fill={tok('ink')} opacity={0.5} /></g>
    </g>
  );
}

export function PostOffice({ c }: P) {
  return (
    <g>
      <Shadow w={170} />
      <rect x={30} y={70} width={140} height={118} fill={wallOf(c)} {...line} />
      <path d="M22 74 H178 L166 44 H34 Z" fill={roofOf(c)} {...line} />
      <rect x={60} y={50} width={80} height={18} rx={4} fill={tok('paper')} {...thin} />
      {/* envelope emblem */}
      <rect x={90} y={53} width={20} height={13} rx={1.5} fill={tok('blush')} {...thin} />
      <path d="M90 54 l10 7 l10 -7" stroke={tok('roseDeep')} strokeWidth={1.4} fill="none" />
      {/* striped awning */}
      <path d="M36 96 H164 L170 116 H30 Z" fill={trimOf(c)} {...line} />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => <path key={i} d={`M${36 + i * 10} 96 h10 l1 20 h-11 z`} fill={accOf(c)} opacity={0.85} />)}
      <Scallops x={30} y={120} w={140} n={10} fill={accOf(c)} />
      <rect x={44} y={128} width={36} height={34} rx={2} fill={winOf(c)} {...thin} className="glow-window" />
      <path d="M50 150 h24 M54 144 h16" stroke={tok('rose')} strokeWidth={3} />
      <path d="M90 188 V136 H124 V188" fill={tok('accent')} {...line} />
      <circle cx={118} cy={162} r={2} fill={tok('gold')} />
      {/* mailbox */}
      <rect x={140} y={150} width={20} height={20} rx={8} fill={tok('roseDeep')} {...thin} />
      <rect x={148} y={170} width={4} height={18} fill={tok('inkSoft')} />
      <path d="M144 158 h12" stroke={tok('paper')} strokeWidth={2} />
      <Bow x={100} y={44} s={0.7} />
    </g>
  );
}

export function Cafe({ c }: P) {
  return (
    <g>
      <Shadow w={170} />
      <rect x={34} y={70} width={132} height={118} fill={wallOf(c)} {...line} />
      <path d="M28 74 Q100 20 172 74 Z" fill={roofOf(c)} {...line} />
      <circle cx={100} cy={56} r={9} fill={tok('cream')} {...thin} />
      <path d="M95 57 h10 v4 a5 5 0 0 1 -10 0 z M105 58 h2 a2 2 0 0 1 0 4 h-2" fill={tok('rose')} />
      <path d="M38 88 H162 L172 112 H28 Z" fill={trimOf(c)} {...line} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${40 + i * 18} 88 h9 l2 24 h-12 z`} fill={tok('pink')} />)}
      <Scallops x={28} y={116} w={144} n={8} fill={tok('pink')} />
      <rect x={44} y={124} width={50} height={40} rx={3} fill={winOf(c)} {...thin} className="glow-window" />
      {/* cake in the window */}
      <path d="M58 156 h22 v-8 h-22 z" fill={tok('cream')} {...thin} />
      <path d="M58 148 q11 -8 22 0" fill={tok('pink')} />
      <circle cx={69} cy={142} r={2.4} fill={tok('roseDeep')} />
      <path d="M108 188 V130 a14 14 0 0 1 28 0 V188 Z" fill={accOf(c)} {...line} />
      <circle cx={130} cy={160} r={2} fill={tok('gold')} />
      {/* bistro table */}
      <ellipse cx={160} cy={172} rx={12} ry={3} fill={tok('trim')} {...thin} />
      <path d="M160 174 V188" {...thin} />
      <path d="M156 168 h6 v-4 h-6 z" fill={tok('rose')} />
    </g>
  );
}

export function Greenhouse({ c }: P) {
  return (
    <g>
      <Shadow w={170} />
      <path d="M24 188 V110 Q100 34 176 110 V188 Z" fill={tok('water')} opacity={0.45} {...line} />
      {/* plants inside */}
      {[40, 64, 88, 112, 136, 156].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 186 q-6 -20 0 -${30 + (i % 3) * 10} q6 20 0 ${30 + (i % 3) * 10}`} fill={tok('sageDeep')} opacity={0.9} />
          <circle cx={x + 4} cy={180 - 30 - (i % 3) * 10} r={4} fill={i % 2 ? tok('pink') : tok('rose')} />
        </g>
      ))}
      <path d="M24 188 V110 Q100 34 176 110 V188" fill="none" stroke={trimOf(c)} strokeWidth={4} />
      {[54, 78, 100, 122, 146].map((x) => <path key={x} d={`M${x} 188 V${x === 100 ? 72 : x < 100 ? 84 + (78 - x) : 84 + (x - 122)}`} stroke={trimOf(c)} strokeWidth={2.4} />)}
      <path d="M24 140 H176" stroke={trimOf(c)} strokeWidth={2.4} />
      <path d="M88 188 V150 H112 V188" fill={wallOf(c)} {...thin} />
      <rect x={18} y={182} width={164} height={8} rx={3} fill={roofOf(c)} {...line} />
      <Bow x={100} y={70} s={0.8} />
    </g>
  );
}

export function Observatory({ c }: P) {
  return (
    <g>
      <Shadow w={130} />
      <path d="M48 188 L56 92 H144 L152 188 Z" fill={wallOf(c)} {...line} />
      <path d="M44 96 a56 56 0 0 1 112 0 Z" fill={roofOf(c)} {...line} />
      <path d="M96 42 a56 56 0 0 1 8 0 L106 96 H94 Z" fill={tok('ink')} opacity={0.55} />
      {/* telescope */}
      <path d="M100 66 L134 34" stroke={tok('gold')} strokeWidth={8} strokeLinecap="round" />
      <path d="M100 66 L134 34" stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d="M100 66 L134 34" stroke={tok('gold')} strokeWidth={7} strokeLinecap="round" />
      <path d="M60 104 H140" stroke={tok('trim')} strokeWidth={3} strokeDasharray="1 7" strokeLinecap="round" />
      <Window x={74} y={116} w={16} h={22} c={c} arch box={false} />
      <Window x={110} y={116} w={16} h={22} c={c} arch box={false} />
      <path d="M86 188 V160 a14 14 0 0 1 28 0 V188 Z" fill={accOf(c)} {...line} />
      {[[30, 30], [168, 50], [24, 80], [172, 120]].map(([x, y], i) => (
        <path key={i} className="twinkle" style={{ animationDelay: `${i * 0.7}s` }} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} fill={tok('gold')} />
      ))}
    </g>
  );
}

export function Well({ c }: P) {
  return (
    <g>
      <Shadow w={130} />
      <path d="M40 120 V60 M160 120 V60" stroke={tok('inkSoft')} strokeWidth={7} strokeLinecap="round" />
      <path d="M28 66 L100 22 L172 66 Z" fill={roofOf(c)} {...line} />
      <Scallops x={30} y={70} w={140} n={7} fill={roofOf(c)} />
      <path d="M40 80 H160" stroke={tok('inkSoft')} strokeWidth={3} />
      <path d="M100 80 V108" stroke={tok('inkSoft')} strokeWidth={1.5} />
      <path d="M90 108 h20 l-3 14 h-14 z" fill={tok('gold')} {...thin} />
      <ellipse cx={100} cy={128} rx={66} ry={14} fill={tok('ink')} opacity={0.5} />
      <path d="M34 128 V180 a66 14 0 0 0 132 0 V128 a66 14 0 0 1 -132 0 Z" fill={tok('cream')} {...line} />
      {[[44, 146], [74, 152], [104, 154], [134, 150], [58, 168], [92, 172], [124, 170], [152, 164]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={22} height={11} rx={4} fill={wallOf(c)} {...thin} />
      ))}
      <Bow x={40} y={92} s={0.8} />
      <path d="M150 140 q8 6 0 14" stroke={tok('sageDeep')} strokeWidth={3} fill="none" />
      <circle cx={152} cy={140} r={3} fill={tok('pink')} />
    </g>
  );
}

export function ManorDoor({ c }: P) {
  return (
    <g>
      <Shadow w={140} />
      <path d="M30 188 V70 Q100 6 170 70 V188 Z" fill={wallOf(c)} {...line} />
      <path d="M50 188 V82 Q100 30 150 82 V188 Z" fill={tok('roseDeep')} {...line} />
      {/* ribbon curtains */}
      <path d="M52 84 Q72 120 64 188 H52 Z" fill={tok('pink')} {...thin} />
      <path d="M148 84 Q128 120 136 188 H148 Z" fill={tok('pink')} {...thin} />
      <path d="M52 84 Q100 54 148 84 Q100 72 52 84 Z" fill={tok('blush')} {...thin} />
      <circle cx={100} cy={128} r={10} fill={tok('gold')} {...thin} />
      <path d="M100 124 v8" stroke={tok('ink')} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      <Bow x={100} y={64} s={1.1} fill={tok('trim')} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={40 + i * 17} cy={186} r={3} fill={tok('trim')} {...thin} />)}
      <path d="M30 70 Q100 6 170 70" fill="none" stroke={pick(c, 'trim', 'gold')} strokeWidth={3} strokeDasharray="1 6" strokeLinecap="round" />
    </g>
  );
}

export function Fountain(_: P) {
  return (
    <g>
      <Shadow w={170} />
      <ellipse cx={100} cy={160} rx={84} ry={24} fill={tok('cream')} {...line} />
      <ellipse cx={100} cy={156} rx={72} ry={17} fill={tok('water')} />
      <ellipse className="ripple" cx={100} cy={156} rx={40} ry={8} fill="none" stroke={tok('trim')} strokeWidth={2} opacity={0.7} />
      <path d="M90 156 V108 H110 V156" fill={tok('cream')} {...line} />
      <ellipse cx={100} cy={106} rx={34} ry={9} fill={tok('cream')} {...line} />
      <ellipse cx={100} cy={104} rx={28} ry={6} fill={tok('water')} />
      <path d="M96 104 V76 H104 V104" fill={tok('cream')} {...thin} />
      <path d="M100 74 c-8 -10 -20 -2 -12 8 l12 10 l12 -10 c8 -10 -4 -18 -12 -8 z" fill={tok('rose')} {...thin} />
      <g className="water-fall">
        <path d="M74 106 q-12 20 -10 46" stroke={tok('water')} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.9} />
        <path d="M126 106 q12 20 10 46" stroke={tok('water')} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.9} />
      </g>
      <circle className="sparkle" cx={70} cy={140} r={2.5} fill={tok('trim')} />
      <circle className="sparkle" style={{ animationDelay: '1s' }} cx={132} cy={146} r={2} fill={tok('trim')} />
    </g>
  );
}
