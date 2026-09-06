export type GroupTripRow = {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  badge_ar: string;
  badge_en: string;
  dates_ar?: string | null;
  dates_en?: string | null;
  price?: string | null;
  includes_ar?: string | null;
  includes_en?: string | null;
  excludes_ar?: string | null;
  excludes_en?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  max_seats?: number | null;
  booked_seats?: number | null;
  /**
   * Live count of group_members with confirmed_seat / confirmed.
   * Prefer this over booked_seats (which can drift after failed optimistic updates).
   */
  confirmed_seats_count?: number | null;
  allow_waitlist?: boolean | null;
  leader_id?: number | null;
  leader_name?: string | null;
  registered_client_ids?: number[] | null;
};

/** Canonical alias — same as GroupTripRow (table: public.group_trips) */
export type GroupTrip = GroupTripRow;

export type { GroupMember, GroupMemberStatus } from '@/lib/group-members';
