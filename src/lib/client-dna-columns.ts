/** أعمدة DNA المباشرة في جدول clients — مصدر واحد للنموذج العام و CRM */

export type ClientDnaDirectColumns = {
  flight_seat: string | null
  food_allergies: string | null
  favorite_drink: string | null
  hotel_preference: string | null
  passport_expiry: string | null
  dna_interests: string | null
  dna_activity_level: string | null
}

export function formatInterestsForDnaColumn(interests: string[]): string {
  return interests.map((x) => x.trim()).filter(Boolean).join('، ')
}

export function buildClientDnaDirectColumns(fields: {
  flight_seat?: string
  food_allergies?: string
  favorite_drink?: string
  hotel_preference?: string
  passport_expiry?: string | null
  dna_interests?: string
  dna_activity_level?: string
}): ClientDnaDirectColumns {
  return {
    flight_seat: fields.flight_seat?.trim() || null,
    food_allergies: fields.food_allergies?.trim() || null,
    favorite_drink: fields.favorite_drink?.trim() || null,
    hotel_preference: fields.hotel_preference?.trim() || null,
    passport_expiry: fields.passport_expiry?.trim() || null,
    dna_interests: fields.dna_interests?.trim() || null,
    dna_activity_level: fields.dna_activity_level?.trim() || null,
  }
}

function buildTravelDnaJson(direct: ClientDnaDirectColumns): Record<string, string> {
  const out: Record<string, string> = {}
  if (direct.flight_seat) {
    out.flight_seat = direct.flight_seat
    out.preferred_seat = direct.flight_seat
  }
  if (direct.food_allergies) {
    out.food_allergies = direct.food_allergies
    out.food_preference = direct.food_allergies
  }
  if (direct.hotel_preference) {
    out.hotel_preference = direct.hotel_preference
    out.hotel_style = direct.hotel_preference
    out.hotel_type = direct.hotel_preference
  }
  if (direct.favorite_drink) {
    out.favorite_drink = direct.favorite_drink
    out.drink_coffee = direct.favorite_drink
  }
  return out
}

/** مزامنة الأعمدة المباشرة مع الحقول التقليدية و travel_dna */
export function clientDnaSupabasePatch(fields: {
  flight_seat?: string
  food_allergies?: string
  favorite_drink?: string
  hotel_preference?: string
  passport_expiry?: string | null
  dna_interests?: string
  dna_activity_level?: string
}): Record<string, unknown> {
  const direct = buildClientDnaDirectColumns(fields)
  const travel_dna = buildTravelDnaJson(direct)
  const dietaryParts = [
    direct.food_allergies,
    direct.favorite_drink ? `مشروب: ${direct.favorite_drink}` : '',
  ].filter(Boolean)

  return {
    ...direct,
    flight_preferences: direct.flight_seat,
    hotel_preferences: direct.hotel_preference,
    dietary: dietaryParts.length ? dietaryParts.join(' · ') : null,
    ...(Object.keys(travel_dna).length ? { travel_dna } : {}),
  }
}
