/**
 * جدول sessions: id, title, date, session_type, price, spots (المقاعد المتبقية), description, created_at
 * جدول session_registrations: id, session_id, name, whatsapp, created_at
 */

export interface Session {
  id?: string;
  title: string;
  /** تاريخ الجلسة (عمود `date` في Supabase — غالباً YYYY-MM-DD أو ما يعيده الـ API). */
  date: string;
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
  /** وقت تسجيل العميل؛ يُعاد من Supabase بعد الإدراج أو من العمود الافتراضي في قاعدة البيانات. */
  created_at?: string;
}

/** إدراج تسجيل جديد — عادة بدون `id` و`created_at` (يولّدهما الخادم). */
export type SessionRegistrationInsert = Pick<SessionRegistration, 'session_id' | 'name' | 'whatsapp'>;
