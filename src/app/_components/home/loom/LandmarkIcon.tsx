/**
 * Line-art landmarks for the «النَّول» redesign (48×48 grid, stroke = currentColor).
 * Decorative — callers pair them with a visible text label.
 */
export type LandmarkId = 'japan' | 'korea' | 'uk' | 'france' | 'italy' | 'switzerland' | 'onsen';

const PATHS: Record<LandmarkId, string> = {
  // torii gate
  japan: 'M4 11 Q24 15 44 11 M8 18 H40 M13 11 V42 M35 11 V42 M10 26 H38',
  // palace roof (Gyeongbokgung)
  korea: 'M4 20 Q14 22 24 13 Q34 22 44 20 M9 21 V40 M39 21 V40 M17 23 V40 M31 23 V40 M6 40 H42 M12 29 H36',
  // Big Ben
  uk: 'M18 44 V16 H30 V44 M16 16 H32 M18 16 L24 4 L30 16 M14 44 H34 M24 20 a4 4 0 1 0 0.01 0',
  // Eiffel tower
  france: 'M24 3 V9 M21 9 H27 M21 9 L13 44 M27 9 L35 44 M17 26 H31 M15 34 H33 M19 44 Q24 36 29 44 M11 44 H37',
  // Colosseum
  italy:
    'M6 18 Q24 10 42 18 M6 18 V40 M42 18 V40 M6 40 H42 M6 28 H42 M11 40 V35 a2 2 0 0 1 4 0 V40 M19 40 V35 a2 2 0 0 1 4 0 V40 M27 40 V35 a2 2 0 0 1 4 0 V40 M35 40 V35 a2 2 0 0 1 4 0 V40',
  // Matterhorn
  switzerland: 'M3 42 L18 20 L24 26 L31 8 L45 42 Z M26 15 L29 19 L32 15',
  // hills + sun
  onsen: 'M3 40 Q12 30 20 34 Q28 24 36 30 Q41 26 45 30 M6 44 H42 M24 8 a6 6 0 1 0 0.1 0',
};

export function LandmarkIcon({
  id,
  size = 48,
  strokeWidth = 2.2,
  className,
}: {
  id: LandmarkId;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[id]} />
    </svg>
  );
}
