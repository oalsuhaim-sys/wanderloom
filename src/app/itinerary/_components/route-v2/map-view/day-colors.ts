/**
 * One colour per trip day for the map view. Hand-picked to stay distinct from each other, readable
 * with white numbers, and calm on both the cream and the dark map. Long trips cycle the list.
 */
export const DAY_COLORS = [
  '#0F5C4D', // deep green
  '#E0634F', // coral
  '#C49A2C', // Wanderloom gold
  '#2A9D8F', // teal
  '#4F5BD5', // indigo
  '#9B4D8B', // plum
  '#D9822B', // amber
  '#3E7CB1', // steel blue
  '#C2456E', // rose
  '#6E8B3D', // olive
  '#8C5A3C', // cinnamon
  '#1F3A5F', // navy
] as const

export function dayColor(index: number): string {
  return DAY_COLORS[((index % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length]!
}
