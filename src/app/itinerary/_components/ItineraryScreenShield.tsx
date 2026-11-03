'use client';

import { useEffect, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

const SHIELD_STYLE = `
.itinerary-simple-shield,
.itinerary-simple-shield * {
  -webkit-user-select: none;
  user-select: none;
}
.itinerary-simple-shield img,
.itinerary-simple-shield svg,
.itinerary-simple-shield canvas {
  -webkit-user-drag: none;
}
`;

function todayLabel() {
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

type Props = {
  children: ReactNode;
  clientName?: string | null;
  clientPhone?: string | null;
};

export default function ItineraryScreenShield({ children, clientName, clientPhone }: Props) {
  useEffect(() => {
    const blockMenu = (event: Event) => event.preventDefault();
    const blockDrag = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', blockMenu);
    document.addEventListener('dragstart', blockDrag);
    return () => {
      document.removeEventListener('contextmenu', blockMenu);
      document.removeEventListener('dragstart', blockDrag);
    };
  }, []);

  const line = `Wanderloom • ${clientName?.trim() || '—'} • ${clientPhone?.trim() || '—'} • ${todayLabel()} • مسار محمي`;
  const tiles = Array.from({ length: 36 }, () => line);

  return (
    <div
      className="itinerary-simple-shield"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      onContextMenu={(event: ReactMouseEvent) => event.preventDefault()}
      onDragStart={(event: DragEvent) => event.preventDefault()}
    >
      <style>{SHIELD_STYLE}</style>
      {children}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden opacity-[0.07]"
        aria-hidden
      >
        <div
          className="absolute left-1/2 top-1/2 flex w-[220vmax] flex-wrap justify-center gap-x-14 gap-y-10"
          style={{ transform: 'translate(-50%, -50%) rotate(-20deg)' }}
        >
          {tiles.map((text, index) => (
            <span
              key={index}
              className="whitespace-nowrap text-sm font-bold tracking-wide text-[#1E2720]"
            >
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
