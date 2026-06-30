'use client';

import { useEffect, useRef, useState } from 'react';

export type SmartPlaceSelection = {
  place_name: string;
  lat: string;
  lng: string;
  maps_url: string;
};

type MapboxFeature = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
};

type Props = {
  value: string;
  onQueryChange: (value: string) => void;
  onPlaceSelect: (place: SmartPlaceSelection) => void;
  cityBias?: string;
};

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
  '';

export default function SmartPlaceSearch({ value, onQueryChange, onPlaceSelect, cityBias }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlaces = async () => {
      const q = value.trim();
      if (q.length < 3) {
        setResults([]);
        setFetchError(null);
        return;
      }

      if (!MAPBOX_TOKEN) {
        setTokenError(true);
        setResults([]);
        return;
      }

      setTokenError(false);
      setLoading(true);
      setFetchError(null);

      try {
        const searchQ = cityBias?.trim() ? `${q} ${cityBias.trim()}` : q;
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQ)}.json` +
          `?access_token=${MAPBOX_TOKEN}&types=poi,place,address&language=ar&limit=6&autocomplete=true`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Mapbox HTTP ${res.status}`);
        }

        const data = (await res.json()) as { features?: MapboxFeature[]; message?: string };
        if (data.message) {
          throw new Error(data.message);
        }

        setResults(data.features ?? []);
      } catch (err) {
        console.error('Mapbox fetch error:', err);
        setResults([]);
        setFetchError('تعذر جلب النتائج — تحقق من التوكن أو الاتصال');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      void fetchPlaces();
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [value, cityBias]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function selectPlace(place: MapboxFeature) {
    const lat = place.center[1];
    const lng = place.center[0];
    const place_name = place.text?.trim() || place.place_name?.split(',')[0]?.trim() || '';

    onQueryChange(place_name);
    setResults([]);

    onPlaceSelect({
      place_name,
      lat: String(lat),
      lng: String(lng),
      maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
  }

  return (
    <div ref={rootRef} className="relative mb-2 w-full">
      <label className="mb-2 block text-sm font-bold text-[#D4AF37]">ابحث عن المكان (تلقائي)</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="مثال: برج إيفل، متحف اللوفر..."
        className="w-full rounded-xl border border-[#D4AF37]/40 bg-[#1E2720] p-3 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
        autoComplete="off"
      />

      {tokenError ? (
        <p className="mt-1 text-xs font-semibold text-amber-700">
          Mapbox token مفقود — أضف NEXT_PUBLIC_MAPBOX_TOKEN في .env.local
        </p>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute start-3 top-[2.65rem] text-xs font-semibold text-[#D4AF37]">
          جاري البحث...
        </div>
      ) : null}

      {fetchError && !loading ? (
        <p className="mt-1 text-xs font-semibold text-red-600">{fetchError}</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="absolute z-[100] mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#D4AF37]/50 bg-[#2A362C] shadow-2xl">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPlace(place)}
                className="w-full border-b border-[#D4AF37]/10 p-3 text-right text-sm text-white transition-colors last:border-0 hover:bg-[#D4AF37]/20"
              >
                <div className="font-bold text-[#D4AF37]">{place.text}</div>
                <div className="text-xs text-white/60">{place.place_name}</div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
