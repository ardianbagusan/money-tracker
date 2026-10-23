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

export type EmailImport = {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  received_at: string;
  type: 'expense' | 'income' | null;
  amount: number | null;
  title: string;
  category_id: number | null;
  wallet_id: number | null;
  source_name: string;
  hint: string;
  status: 'pending' | 'added' | 'dismissed' | 'unreadable';
  maybe_dup: boolean;
};

export type FoodKind = 'food' | 'drink' | 'other';
export type FoodItem = {
  id: number; name: string; aliases: string; kind: FoodKind; portion_g: number;
  kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number; source: string; uses: number;
};
export type CutoutCanvas = { x: number; y: number; rot: number; scale: number; z: number };
export type FoodEntry = {
  id: number; moment_id: number; food_item_id: number | null; name: string; kind: FoodKind; grams: number | null;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; tags: string[];
  cutout: { id: number; width: number; height: number; canvas: CutoutCanvas } | null;
};
export type FoodMoment = {
  id: number; occurred_at: string; place: string; people: string[]; rating: number | null; favorite: boolean; note: string;
  entries: FoodEntry[];
};

export type TradeFill = { id: number; side: 'buy' | 'sell'; price: number; lots: number; fee: number; filled_at: string };
export type Trade = {
  id: number; ticker: string; status: 'open' | 'closed'; setup: string; timeframe: string; stop: number | null; target: number | null;
  tags: string[]; context: string[]; emotion_entry: string; emotion_exit: string; rationale: string; review: string;
  followed_plan: boolean | null; opened_at: string; closed_at: string | null; fills: TradeFill[];
};
