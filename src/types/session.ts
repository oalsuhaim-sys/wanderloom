export interface Session {
  id?: string;
  title: string;
  date: string;
  session_type: string;
  price: number;
  spots: number;
  description: string;
  location_url?: string;
  created_at?: string;
  [key: string]: any;
}

export type SessionInsert = Omit<Session, 'id' | 'created_at'>;

export interface SessionRegistration {
  id?: string;
  session_id: string;
  name: string;
  whatsapp: string;
  created_at?: string;
  [key: string]: any;
}
