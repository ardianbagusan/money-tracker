export type TxType = 'expense' | 'income' | 'transfer' | 'adjust';
export type ItemKind = 'item' | 'tax' | 'fee' | 'discount';

export type Category = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  kind: 'expense' | 'income';
  keywords: string;
  sort: number;
  archived: boolean;
};

export type Wallet = {
  id: number;
  name: string;
  kind: 'cash' | 'bank' | 'ewallet' | 'credit' | 'savings';
  emoji: string;
  initial_balance: number;
  credit_limit: number | null;
  due_day: number | null;
  is_default: boolean;
  archived: boolean;
  sort: number;
  balance?: number;
};

export type Item = { id?: number; name: string; amount: number; kind: ItemKind };

export type Tx = {
  id: number;
  type: TxType;
  amount: number;
  title: string;
  note: string;
  category_id: number | null;
  wallet_id: number;
  to_wallet_id: number | null;
  occurred_at: string; // local wall time "YYYY-MM-DDTHH:mm"
  source: string;
  recurring_id: number | null;
  has_receipt?: boolean;
  item_count?: number;
};

export type Recurring = {
  id: number;
  type: TxType;
  amount: number;
  title: string;
  category_id: number | null;
  wallet_id: number;
  to_wallet_id: number | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_at: string;
  active: boolean;
};

export type Goal = { id: number; name: string; emoji: string; target: number; saved: number };

export type Draft = {
  key: string;
  type: 'expense' | 'income';
  amount: number;
  title: string;
  category_id: number | null;
  wallet_id: number | null;
};

export type Energy = 'low' | 'medium' | 'high';
export type JournalTag = { id: number; name: string; emoji: string; sort: number; archived: boolean };
export type JournalEntry = {
  id: number;
  occurred_at: string; // "YYYY-MM-DDTHH:mm"
  mood: number; // 1–5
  energy: Energy | null;
  tag_ids: number[];
  note: string;
};

export type Sport = 'running' | 'tennis';
export type Workout = {
  id: number;
  sport: Sport;
  occurred_at: string;
  duration_sec: number;
  distance_m: number | null;
  effort: number | null;
  avg_hr: number | null;
  tennis_format: 'singles' | 'doubles' | null;
  result: 'won' | 'lost' | 'draw' | null;
  score: string;
  note: string;
};

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CalEvent = {
  id: number;
  title: string;
  note: string;
  start_at: string; // "YYYY-MM-DDTHH:mm"
  all_day: boolean;
  repeat: Repeat;
  alert_minutes: number | null;
};
