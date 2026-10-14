import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
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

export const IHome = (p: P) => (<svg {...base(p)}><path d="M4 11.2 12 4.5l8 6.7V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" /></svg>);
export const IList = (p: P) => (<svg {...base(p)}><rect x="3.5" y="4" width="17" height="16" rx="4" /><path d="M8 9h8M8 12.5h8M8 16h5" /></svg>);
export const IChart = (p: P) => (<svg {...base(p)}><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg>);
export const IWallet = (p: P) => (<svg {...base(p)}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" /><rect x="4" y="8" width="16.5" height="11.5" rx="3" /><circle cx="16" cy="13.75" r="1.2" fill="currentColor" stroke="none" /></svg>);
export const IGauge = (p: P) => (<svg {...base(p)}><path d="M4.5 17a8 8 0 1 1 15 0" /><path d="m12 13 3.5-4" /><circle cx="12" cy="13.5" r="1.3" fill="currentColor" stroke="none" /></svg>);
export const IGear = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
export const IPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const ISearch = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>);
export const IEye = (p: P) => (<svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>);
export const IEyeOff = (p: P) => (<svg {...base(p)}><path d="M10.6 5.6A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 5.3-1.6M3 3l18 18" /><path d="M9.9 10a2.8 2.8 0 0 0 4.1 4" /></svg>);
export const IReceipt = (p: P) => (<svg {...base(p)}><path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></svg>);
export const IRepeat = (p: P) => (<svg {...base(p)}><path d="M17 2.5 20 5.5l-3 3" /><path d="M4 11V9.5a4 4 0 0 1 4-4h12M7 21.5 4 18.5l3-3" /><path d="M20 13v1.5a4 4 0 0 1-4 4H4" /></svg>);
export const ITrash = (p: P) => (<svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V4.5h6V7" /></svg>);
export const IX = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IChevL = (p: P) => (<svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>);
export const IChevR = (p: P) => (<svg {...base(p)}><path d="m9 5 7 7-7 7" /></svg>);
export const ICheck = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IDownload = (p: P) => (<svg {...base(p)}><path d="M12 4v11M7 10.5 12 15.5l5-5M5 20h14" /></svg>);
export const ISwap = (p: P) => (<svg {...base(p)}><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></svg>);
export const ILogout = (p: P) => (<svg {...base(p)}><path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16.5 5.5 12 10 7.5M5.5 12H16" /></svg>);
export const ICamera = (p: P) => (<svg {...base(p)}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const ISelect = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" /></svg>);
export const IScale = (p: P) => (<svg {...base(p)}><path d="M12 4v16M5 20h14M5 8h14M7.5 8 4.5 14a3 3 0 0 0 6 0zM16.5 8l-3 6a3 3 0 0 0 6 0z" /></svg>);
export const ITarget = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>);
export const IEdit = (p: P) => (<svg {...base(p)}><path d="M14.5 5.5 18.5 9.5M4 20l1-4.5L15.8 4.7a1.5 1.5 0 0 1 2.1 0l1.4 1.4a1.5 1.5 0 0 1 0 2.1L8.5 19z" /></svg>);
export const IStar = (p: P) => (<svg {...base(p)}><path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" /></svg>);
export const IArrowUp = (p: P) => (<svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const ICalendar = (p: P) => (<svg {...base(p)}><rect x="4" y="5.5" width="16" height="15" rx="3" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg>);
export const IBook = (p: P) => (<svg {...base(p)}><path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h9.5M9 8.5h5" /></svg>);
export const IBell = (p: P) => (<svg {...base(p)}><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>);
export const ISmile = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14a4.2 4.2 0 0 0 7 0" /><circle cx="9.2" cy="10" r=".9" fill="currentColor" stroke="none" /><circle cx="14.8" cy="10" r=".9" fill="currentColor" stroke="none" /></svg>);
export const IRun = (p: P) => (<svg {...base(p)}><circle cx="14.5" cy="4.8" r="1.8" /><path d="m7 21 3.2-5.2 3 2.2V13l-3-2.5 3.5-3 2.3 3.2H19M9.8 10.5 7.5 13" /></svg>);
export const ITennis = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M5.5 6.5a9 9 0 0 1 0 11M18.5 6.5a9 9 0 0 0 0 11" /></svg>);
export const IPulse = (p: P) => (<svg {...base(p)}><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></svg>);
