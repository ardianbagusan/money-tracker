// Original watercolour-style landscapes drawn as SVG, then rendered to JPG by
// scripts/render-art.py. Run that script again if you change anything here.
// Lake, hills, pines and autumn trees in pastel blue and orange.

const PALETTES = {
  dawn: {
    sky: ['#C9DCF2', '#F3DCCF', '#F8CDB0'],
    sun: '#F6AE7C', sunGlow: '#FBD7B8', sunY: 0.34,
    cloud: '#FBE6D9', cloud2: '#E3D6EE',
    far: '#B9CBE6', mid: '#91ADD6', near: '#6F8FC2',
    trees: ['#F3A877', '#F6C29A', '#EE9767'],
    lake: ['#F6D6C2', '#C7DAF0', '#A9C3E6'],
    pine: '#4D6C9E', pine2: '#5E7DB0', grass: '#7E9CCB',
    birds: '#5B6F94', stars: 0,
  },
  day: {
    sky: ['#9FCBF0', '#C7E1F6', '#F1E5D6'],
    sun: '#F8BB82', sunGlow: '#FDE3C6', sunY: 0.26,
    cloud: '#FFFFFF', cloud2: '#DDEAF7',
    far: '#C0D5EE', mid: '#97B8E0', near: '#6E92C6',
    trees: ['#F2A26E', '#F6C091', '#EC8E5C'],
    lake: ['#D9EAF8', '#AFCDEE', '#8DB3E2'],
    pine: '#43669A', pine2: '#5779AE', grass: '#7A9ACB',
    birds: '#4F6690', stars: 0,
  },
  dusk: {
    sky: ['#8FA5DA', '#E9B3A6', '#F8CD9C'],
    sun: '#F2935F', sunGlow: '#F9C69A', sunY: 0.42,
    cloud: '#F6C0AE', cloud2: '#B6A9DA',
    far: '#9DAED8', mid: '#7287C2', near: '#4F679F',
    trees: ['#E8925F', '#F0AE7E', '#DA7D50'],
    lake: ['#F2BE98', '#A9B5DE', '#7C8FC6'],
    pine: '#33497C', pine2: '#425A90', grass: '#55699E',
    birds: '#3F4F7A', stars: 0,
  },
  night: {
    sky: ['#14244A', '#233A6E', '#3E5891'],
    sun: '#F5E6C6', sunGlow: '#9DB0DA', sunY: 0.22,
    cloud: '#34508A', cloud2: '#2A4277',
    far: '#3A5287', mid: '#2C4373', near: '#1F335E',
    trees: ['#9C7468', '#AE8574', '#8E665D'],
    lake: ['#2C4579', '#22386A', '#1A2D58'],
    pine: '#13234A', pine2: '#1A2D58', grass: '#1E3360',
    birds: '#9AAED6', stars: 1,
  },
};

// Small seeded random so every render is the same picture.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function ridge(r, w, baseY, amp, steps, jag = 0.5) {
  // A soft mountain ridge from left to right, closed to the bottom.
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = baseY - amp * (0.55 + 0.45 * Math.sin(i * 0.9 + r() * 2)) * (0.6 + r() * jag);
    pts.push([x, y]);
  }
  let d = `M -20 ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  d += ` L ${w + 20} ${pts[pts.length - 1][1]} L ${w + 20} ${baseY + 400} L -20 ${baseY + 400} Z`;
  return d;
}

function pine(x, base, h, wdt) {
  // Layered fir: three stacked soft triangles.
  let d = '';
  const tiers = 5;
  for (let k = 0; k < tiers; k++) {
    const top = base - h + k * h * 0.15;
    const bot = top + h * (0.26 + k * 0.03);
    const half = wdt * (0.16 + k * 0.1);
    d += `M ${x} ${top} Q ${x + half * 0.35} ${bot - h * 0.1} ${x + half} ${bot} Q ${x} ${bot - h * 0.06} ${x - half} ${bot} Q ${x - half * 0.35} ${bot - h * 0.1} ${x} ${top} Z `;
  }
  d += `M ${x - wdt * 0.05} ${base - h * 0.2} h ${wdt * 0.1} v ${h * 0.22} h ${-wdt * 0.1} Z`;
  return d;
}

export function landscapeSVG(variant = 'day', W = 1600, H = 640, opts = {}) {
  const p = PALETTES[variant];
  const r = rng(opts.seed ?? 7);
  const horizon = H * (opts.horizon ?? 0.68);
  const sunX = W * (opts.sunX ?? 0.72);
  const sunY = H * p.sunY;
  const sunR = Math.min(W, H) * 0.075;

  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cx = r() * W;
    const cy = H * (0.1 + r() * 0.28);
    const s = 0.6 + r() * 0.9;
    clouds.push(`<g opacity="${(0.45 + r() * 0.35).toFixed(2)}">
      <ellipse cx="${cx}" cy="${cy}" rx="${150 * s}" ry="${34 * s}" fill="${i % 2 ? p.cloud2 : p.cloud}"/>
      <ellipse cx="${cx + 70 * s}" cy="${cy - 18 * s}" rx="${90 * s}" ry="${30 * s}" fill="${p.cloud}"/>
      <ellipse cx="${cx - 80 * s}" cy="${cy + 6 * s}" rx="${80 * s}" ry="${22 * s}" fill="${p.cloud}"/></g>`);
  }

  const stars = [];
  if (p.stars) for (let i = 0; i < 70; i++) stars.push(`<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * horizon * 0.75).toFixed(0)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="#F7EBD0" opacity="${(0.35 + r() * 0.6).toFixed(2)}"/>`);

  // Autumn tree blobs along the mid hills, mostly right of centre
  const trees = [];
  for (let i = 0; i < 46; i++) {
    const x = W * (0.08 + r() * 0.9);
    const y = horizon - 8 - r() * 30 - (x > W * 0.45 ? 10 : 0);
    const rr = 12 + r() * 22;
    const c = p.trees[i % p.trees.length];
    trees.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rr.toFixed(0)}" ry="${(rr * 1.15).toFixed(0)}" fill="${c}" opacity="${(0.7 + r() * 0.3).toFixed(2)}"/>`);
  }

  // Pines in the foreground, framing left and right
  const pinesL = [];
  const pinesR = [];
  for (let i = 0; i < 9; i++) {
    const x = W * (0.0 + i * 0.028) + r() * 14;
    const h = H * (0.24 + r() * 0.2);
    pinesL.push(`<path d="${pine(x, H * 0.97 - r() * 30, h, h * 0.5)}" fill="${i % 2 ? p.pine : p.pine2}"/>`);
  }
  for (let i = 0; i < 7; i++) {
    const x = W * (0.83 + i * 0.03) + r() * 14;
    const h = H * (0.22 + r() * 0.2);
    pinesR.push(`<path d="${pine(x, H * 0.98 - r() * 26, h, h * 0.5)}" fill="${i % 2 ? p.pine2 : p.pine}"/>`);
  }

  // Reeds and grass strokes along the shore
  const reeds = [];
  for (let i = 0; i < 55; i++) {
    const x = r() * W;
    const by = H * (0.93 + r() * 0.08);
    const h = 18 + r() * 46;
    const lean = (r() - 0.5) * 18;
    const col = r() < 0.18 ? p.trees[0] : p.grass;
    reeds.push(`<path d="M ${x.toFixed(0)} ${by.toFixed(0)} q ${(lean / 2).toFixed(0)} ${(-h / 2).toFixed(0)} ${lean.toFixed(0)} ${(-h).toFixed(0)}" stroke="${col}" stroke-width="${(3 + r() * 3).toFixed(1)}" stroke-linecap="round" fill="none" opacity="0.85"/>`);
  }

  const birds = [];
  for (let i = 0; i < 4; i++) {
    const x = W * (0.32 + r() * 0.3);
    const y = H * (0.18 + r() * 0.16);
    const s = 7 + r() * 7;
    birds.push(`<path d="M ${x - s} ${y} q ${s / 2} ${-s / 2} ${s} 0 q ${s / 2} ${-s / 2} ${s} 0" stroke="${p.birds}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  }

  // Lake shimmer strokes
  const shimmer = [];
  for (let i = 0; i < 26; i++) {
    const y = horizon + 14 + r() * (H * 0.2);
    const x = sunX + (r() - 0.5) * 220 * (1 + (y - horizon) / 120);
    const len = 30 + r() * 120;
    shimmer.push(`<path d="M ${(x - len / 2).toFixed(0)} ${y.toFixed(0)} h ${len.toFixed(0)}" stroke="${p.sunGlow}" stroke-width="${(2 + r() * 3).toFixed(1)}" stroke-linecap="round" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.sky[0]}"/><stop offset="0.55" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/>
    </linearGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.lake[0]}"/><stop offset="0.45" stop-color="${p.lake[1]}"/><stop offset="1" stop-color="${p.lake[2]}"/>
    </linearGradient>
    ${['far', 'mid', 'near'].map((k) => `<linearGradient id="g-${k}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p[k]}" stop-opacity="1"/><stop offset="0.5" stop-color="${p[k]}" stop-opacity="0.82"/><stop offset="1" stop-color="${p.sky[2]}" stop-opacity="0.35"/></linearGradient>`).join('')}
    <radialGradient id="glow"><stop offset="0" stop-color="${p.sunGlow}" stop-opacity="0.95"/><stop offset="1" stop-color="${p.sunGlow}" stop-opacity="0"/></radialGradient>

    <!-- Wobbly pigment edges with darker rims where the paint pools -->
    <filter id="wc" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="4" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1.4" result="soft"/>
      <feMorphology in="soft" operator="erode" radius="3" result="inner"/>
      <feGaussianBlur in="inner" stdDeviation="5" result="innerSoft"/>
      <feComposite in="soft" in2="innerSoft" operator="arithmetic" k1="0" k2="1.25" k3="-0.42" k4="0" result="rim"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="9" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.12" result="grainA"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="2" seed="17" result="bloomN"/>
      <feColorMatrix in="bloomN" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 0.05" result="bloomA"/>
      <feComposite in="rim" in2="bloomA" operator="in" result="bloomed"/>
      <feComposite in="soft" in2="grainA" operator="in" result="granulated"/>
      <feMerge><feMergeNode in="rim"/><feMergeNode in="bloomed"/><feMergeNode in="granulated"/></feMerge>
    </filter>
    <filter id="wash" x="-20%" y="-50%" width="140%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="40" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="9"/>
    </filter>
    <filter id="bleed" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="0.8"/>
    </filter>
    <filter id="paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="2" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0.13 0"/>
    </filter>
    <filter id="blotch" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="2" seed="21" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 0.93  0 0 0 0 0.86  0 0 0 0.9 -0.25"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars.join('')}
  <circle cx="${sunX}" cy="${sunY}" r="${sunR * 3.4}" fill="url(#glow)"/>
  <g filter="url(#bleed)"><circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${p.sun}" opacity="0.95"/></g>
  <g filter="url(#wash)">${clouds.join('')}</g>

  <g filter="url(#wc)">
    <path d="${ridge(r, W, horizon - H * 0.12, H * 0.22, 9)}" fill="url(#g-far)"/>
    <path d="${ridge(rng(41), W, horizon - H * 0.15, H * 0.12, 7)}" fill="${p.far}" opacity="0.35"/>
  </g>
  <g filter="url(#wc)">
    <path d="${ridge(r, W, horizon - H * 0.02, H * 0.16, 12, 0.7)}" fill="url(#g-mid)"/>
  </g>
  <g filter="url(#wc)">${trees.join('')}</g>

  <g filter="url(#wc)"><rect x="-20" y="${horizon - 4}" width="${W + 40}" height="${H - horizon + 30}" fill="url(#lake)"/></g>
  <g filter="url(#bleed)" opacity="0.9">${shimmer.join('')}</g>
  <g filter="url(#wc)" opacity="0.35">
    <path d="${ridge(rng(99), W, horizon + H * 0.08, -H * 0.06, 10)}" fill="${p.mid}" transform="translate(0 0)" />
  </g>

  <g filter="url(#wc)">
    <path d="M -20 ${H * 0.9} Q ${W * 0.25} ${H * 0.84} ${W * 0.45} ${H * 0.93} T ${W + 20} ${H * 0.9} L ${W + 20} ${H + 20} L -20 ${H + 20} Z" fill="url(#g-near)"/>
  </g>
  <g filter="url(#wc)">${pinesL.join('')}${pinesR.join('')}</g>
  <g filter="url(#bleed)">${reeds.join('')}</g>
  <g filter="url(#bleed)">${birds.join('')}</g>

  <rect width="${W}" height="${H}" filter="url(#blotch)" style="mix-blend-mode:soft-light"/>
  <rect width="${W}" height="${H}" filter="url(#paper)" style="mix-blend-mode:multiply"/>
</svg>`;
}

export const VARIANTS = Object.keys(PALETTES);
