import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  Coffee,
  MapPin,
  ShoppingBag,
  Sparkles,
  Star,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';

import { PLACES_BANK_CATEGORIES, placeBankCategoryLabel } from '@/lib/places-bank';

export type VipPlaceCategoryCode =
  | 'l'
  | 'r'
  | 'c'
  | 's'
  | 'd'
  | 'h'
  | 'f'
  | 'o'
  | 'transport'
  | 'other';

export type VipPlaceCategoryMeta = {
  code: VipPlaceCategoryCode;
  label: string;
  Icon: LucideIcon;
  accentClass: string;
};

const META: Record<string, Omit<VipPlaceCategoryMeta, 'code' | 'label'> & { label?: string }> = {
  h: { Icon: BedDouble, accentClass: 'bg-[#1E2720]/8 text-[#1E2720]', label: '🏨 فندق' },
  r: { Icon: UtensilsCrossed, accentClass: 'bg-[#D4AF37]/15 text-[#1E2720]', label: '🍽️ مطعم' },
  c: { Icon: Coffee, accentClass: 'bg-[#D4AF37]/12 text-[#1E2720]', label: '☕ كافيه' },
  s: { Icon: ShoppingBag, accentClass: 'bg-[#1E2720]/6 text-[#1E2720]', label: '🛍️ تسوق' },
  l: { Icon: Star, accentClass: 'bg-[#D4AF37]/10 text-[#1E2720]', label: '⭐ معلم' },
  d: { Icon: Sparkles, accentClass: 'bg-[#D4AF37]/15 text-[#1E2720]', label: '🎭 تجربة' },
  f: { Icon: Utensils, accentClass: 'bg-[#D4AF37]/12 text-[#1E2720]', label: '🍜 طعام' },
  o: { Icon: MapPin, accentClass: 'bg-[#1E2720]/5 text-[#1E2720]/80', label: '🧭 أخرى' },
  transport: { Icon: MapPin, accentClass: 'bg-[#1E2720]/5 text-[#1E2720]/60' },
};

export function normalizePlaceCategoryCode(raw: string): VipPlaceCategoryCode {
  const c = raw.trim().toLowerCase();
  if (c === 'transport' || c === 'transit') return 'transport';
  if (c in META && c !== 'transport') return c as VipPlaceCategoryCode;
  return 'o';
}

export function getVipPlaceCategoryMeta(raw: string): VipPlaceCategoryMeta {
  const code = normalizePlaceCategoryCode(raw);
  const row = META[code] ?? META.o!;
  const label =
    row.label ?? placeBankCategoryLabel(code === 'other' ? 'o' : code) ?? PLACES_BANK_CATEGORIES.o;
  return {
    code,
    label,
    Icon: row.Icon,
    accentClass: row.accentClass,
  };
}

export function isTransportCategoryCode(raw: string): boolean {
  return normalizePlaceCategoryCode(raw) === 'transport';
}
