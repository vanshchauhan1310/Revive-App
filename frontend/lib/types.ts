export type Kind = 'food' | 'non_food';
export type ExchangeMode = 'free' | 'credits';
export type Condition = 'new' | 'like_new' | 'good' | 'fair';

export interface PublicProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  neighborhood?: string | null;
  reliability_score?: number | null;
}

export interface Profile extends PublicProfile {
  phone: string | null;
  lat: number | null;
  lng: number | null;
  role: 'user' | 'admin';
  notification_prefs: { orders: boolean; messages: boolean };
  email?: string;
  email_confirmed?: boolean;
  created_at: string;
}

export interface Wallet {
  balance: number;
  held: number;
  available: number;
}

export interface Me {
  profile: Profile;
  wallet: Wallet;
  unread_notifications: number;
}

export interface Category {
  slug: string;
  kind: Kind;
  label: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  kind: Kind;
  category: string;
  condition: Condition | null;
  exchange_mode: ExchangeMode;
  price_credits: number;
  quantity_label: string | null;
  images: string[];
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  allergens: string[];
  dietary_tags: string[];
  prepared_at: string | null;
  expires_at: string | null;
  storage_info: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  status: 'pending_review' | 'available' | 'reserved' | 'completed' | 'archived' | 'removed';
  ai_assisted?: boolean;
  est_weight_kg?: number | null;
  created_at: string;
  owner?: PublicProfile | null;
  distance_km?: number | null;
  saved?: boolean;
  my_order?: { id: string; status: OrderStatus } | null;
  rank?: number;
  score?: number;
}

export type OrderStatus =
  | 'requested' | 'accepted' | 'ready_for_pickup' | 'completed'
  | 'declined' | 'cancelled' | 'expired' | 'disputed';

export interface Order {
  id: string;
  listing_id: string;
  requester_id: string;
  owner_id: string;
  status: OrderStatus;
  message: string | null;
  listing_title: string;
  price_credits: number;
  fee_credits: number;
  held_credits: number;
  otp_expires_at: string | null;
  otp_attempts: number;
  cancel_reason: string | null;
  impact_kg_co2e: number | null;
  impact_kg_waste: number | null;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  role: 'owner' | 'requester';
  listing: Pick<Listing, 'id' | 'images' | 'kind' | 'category' | 'status'> | null;
  owner: PublicProfile | null;
  requester: PublicProfile | null;
  settlement?: { total_credits: number; created_at: string } | null;
  chat_id?: string | null;
}

export interface InboxItem {
  chat_id: string;
  listing_id: string | null;
  listing_title: string | null;
  other_user_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface Message {
  id: number;
  chat_id: string;
  sender_id: string;
  body: string;
  client_id: string;
  flagged: boolean;
  created_at: string;
  // client-only
  pending?: 'sending' | 'failed';
}

export interface LedgerEntry {
  id: number;
  tx_id: string;
  amount: number;
  kind: string;
  order_id: string | null;
  description: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  order_id: string | null;
  listing_id: string | null;
  chat_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Impact {
  exchanges: number;
  food_exchanges: number;
  kg_co2e: number;
  kg_waste: number;
  members: number;
}

export interface ListingSuggestion {
  title: string;
  description: string;
  kind: Kind | null;
  category: string | null;
  condition: Condition | null;
  allergens: string[];
  dietary_tags: string[];
  storage_info: string | null;
  shelf_life_hours: number | null;
  est_weight_kg: number | null;
  safety_notes: string[];
  confidence: number | null;
}
