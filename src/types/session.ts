export interface Session {
  id?: string;
  title: string;
  date: string;
  /** وقت الجلسة HH:mm (عمود `time` في Supabase). */
  time?: string | null;
  /** English title / description for the English site (optional). */
  title_en?: string | null;
  description_en?: string | null;
  session_type: string;
  price: number;
  spots: number;
  description: string;
  location_url?: string;
  created_at?: string;
}

export type SessionInsert = Omit<Session, 'id' | 'created_at'>;

export interface SessionRegistration {
  id?: string;
  session_id: string;
  name: string;
  whatsapp: string;
  created_at?: string;
}
