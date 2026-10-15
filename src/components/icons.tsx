import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
/** An emoji used as an icon. Accepts the same props the drawn icons did. */
function emoji(char: string) {
  return function EmojiIcon(p: P) {
    const label = (p as any)['aria-label'] as string | undefined;
    const size = p.width ? Number(p.width) * 0.85 : undefined;
    return (
      <span className={`emo ${p.className ?? ''}`} style={{ ...(size ? { fontSize: size } : {}), ...(p.style as any) }}
        role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {char}
      </span>
    );
  };
}

const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const IHome = emoji('🏡');
export const IList = emoji('🧾');
export const IChart = emoji('📊');
export const IWallet = emoji('👛');
export const IGauge = emoji('🎯');
export const IGear = emoji('⚙️');
export const IPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const ISearch = emoji('🔍');
export const IEye = emoji('👁️');
export const IEyeOff = emoji('🙈');
export const IReceipt = emoji('🧾');
export const IRepeat = emoji('🔁');
export const ITrash = emoji('🗑️');
export const IX = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IChevL = (p: P) => (<svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>);
export const IChevR = (p: P) => (<svg {...base(p)}><path d="m9 5 7 7-7 7" /></svg>);
export const ICheck = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IDownload = emoji('📤');
export const ISwap = emoji('🔁');
export const ILogout = emoji('🚪');
export const ICamera = emoji('📷');
export const ISelect = emoji('☑️');
export const IScale = emoji('⚖️');
export const ITarget = emoji('🎯');
export const IEdit = emoji('✏️');
export const IStar = emoji('⭐');
export const IArrowUp = (p: P) => (<svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const ICalendar = emoji('📅');
export const IBook = emoji('📔');
export const IBell = emoji('🔔');
export const ISmile = emoji('🌤️');
export const IRun = emoji('🏃');
export const ITennis = emoji('🎾');
export const IPulse = emoji('💓');
export const IMoney = emoji('💰');
export const IMail = emoji('📬');
