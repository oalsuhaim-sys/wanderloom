'use client';

import { useEffect, useRef, useState } from 'react';

export type SmartPlaceSelection = {
  place_name: string;
  lat: string;
  lng: string;
  maps_url: string;
};

type PhotonProperties = {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  street?: string;
  housenumber?: string;
  district?: string;
};

type PhotonFeature = {
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

function formatPhotonLabel(props: PhotonProperties): string {
  const name = props.name?.trim() || '';
  const parts = [
    props.housenumber,
    props.street,
    props.district,
    props.city,
    props.state,
    props.country,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  const tail = parts.join(', ');
  if (name && tail && !tail.startsWith(name)) return `${name}, ${tail}`;
  return name || tail || 'مكان';
}

function mapPhotonFeatures(
  features: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: PhotonProperties;
  }>,
): PhotonFeature[] {
  return features
    .map((f, i) => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const props = f.properties ?? {};
      const text = props.name?.trim() || formatPhotonLabel(props);
      const place_name = formatPhotonLabel(props);
      return {
        id: `photon-${i}-${coords[0]}-${coords[1]}`,
        text,
        place_name,
        center: coords,
      };
    })
    .filter((row): row is PhotonFeature => row != null);
}

export default function SmartPlaceSearch({ value, onQueryChange, onPlaceSelect, cityBias }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlaces = async () => {
      const q = value.trim();
      if (q.length < 3) {
        setResults([]);
        setFetchError(null);
        return;
      }

      setLoading(true);
      setFetchError(null);

      try {
        const searchQ = cityBias?.trim() ? `${q} ${cityBias.trim()}` : q;
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQ)}&limit=10`,
        );
        if (!res.ok) {
          throw new Error(`Photon HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          features?: Array<{
            geometry?: { coordinates?: [number, number] };
            properties?: PhotonProperties;
          }>;
        };

        setResults(mapPhotonFeatures(data.features ?? []));
      } catch (err) {
        console.error('Photon fetch error:', err);
        setResults([]);
        setFetchError('تعذر جلب النتائج — تحقق من الاتصال');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      void fetchPlaces();
    }, 400);

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

  function selectPlace(place: PhotonFeature) {
    const lng = place.center[0];
    const lat = place.center[1];
    const place_name = place.text?.trim() || place.place_name?.split(',')[0]?.trim() || '';
    const mapsQuery = place.place_name?.trim() || place_name;
    const maps_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

    onQueryChange(place_name);
    setResults([]);

    onPlaceSelect({
      place_name,
      lat: String(lat),
      lng: String(lng),
      maps_url,
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
        className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-bold text-slate-900 placeholder:text-slate-600 focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
        autoComplete="off"
      />

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
                className="w-full border-b border-slate-100 p-3 text-right text-sm text-slate-800 transition-colors last:border-0 hover:bg-slate-50"
              >
                <div className="font-bold text-slate-900">{place.text}</div>
                <div className="text-xs font-bold text-slate-700">{place.place_name}</div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
