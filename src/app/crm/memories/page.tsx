"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { enrichClientMemories } from "@/lib/client-memories-merge";
import {
  deleteApprovedClientMemory,
  getExactApprovedMemoryCounts,
} from "@/app/actions/clientMemoryActions";

type ViewState = "clients" | "trips" | "photos";

type ClientOption = {
  id: number;
  name: string;
};

type ItineraryOption = {
  id: number;
  title: string | null;
  destination: string | null;
};

type ClientMemoryRow = {
  id: number | string;
  client_id?: number | string | null;
  itinerary_id?: number | string | null;
  image_url: string;
  caption?: string | null;
  location_name?: string | null;
  location?: string | null;
  map_url?: string | null;
  created_at?: string | null;
  client_name?: string | null;
  destination?: string | null;
  clients?: { id: number | string; name: string };
  itineraries?: { id: number | string; title: string };
};

type ClientSummary = {
  id: number | string;
  name: string;
  photoCount: number;
  tripCount: number;
};

type TripSummary = {
  id: number | string;
  title: string;
  destination: string | null;
  photoCount: number;
  pendingCount: number;
};

type DisplayPhoto = {
  key: string;
  image_url: string;
  status: "saved" | "pending";
  storagePath?: string;
  dbId?: number | string;
  location_name?: string | null;
  map_url?: string | null;
  created_at?: string | null;
};

type MemoryFormState = {
  client_id: string;
  itinerary_id: string;
  location_name: string;
  rating: number;
  client_review: string;
};

const UNASSIGNED_CLIENT_KEY = "__unassigned__";

const emptyForm = (): MemoryFormState => ({
  client_id: "",
  itinerary_id: "",
  location_name: "",
  rating: 5,
  client_review: "",
});

const FIELD_CLASS =
  "w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] text-gray-800 bg-white";

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+/g, "/").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function fileNameFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

/**
 * Bucket-relative path only (never a full public URL).
 * `42/photo.jpg` or extract from
 * `.../storage/v1/object/public/memories/42/photo.jpg`
 */
function toBucketRelativePath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let path = String(raw).trim();
  if (!path) return null;

  const markers = [
    "/object/public/memories/",
    "/object/sign/memories/",
    "/storage/v1/object/public/memories/",
  ];
  for (const marker of markers) {
    const idx = path.indexOf(marker);
    if (idx >= 0) {
      path = path.slice(idx + marker.length);
      break;
    }
  }

  path = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep raw */
  }
  path = path.replace(/^\/+/, "");

  if (!path || path.includes("://") || path.includes("..")) return null;
  return path;
}

function isImageObject(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);
}

async function listStorageImages(folder: string): Promise<
  Array<{
    path: string;
    publicUrl: string;
    createdAt: string | null;
    metadata: Record<string, string>;
  }>
> {
  if (!supabase || !folder.trim()) return [];

  const { data, error } = await supabase.storage.from("memories").list(folder, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) {
    console.warn("[memories-inbox] storage list failed:", folder, error?.message);
    return [];
  }

  const out: Array<{
    path: string;
    publicUrl: string;
    createdAt: string | null;
    metadata: Record<string, string>;
  }> = [];
  for (const item of data) {
    if (!item?.name || item.name === ".emptyFolderPlaceholder") continue;
    if (!isImageObject(item.name)) continue;
    const path = `${folder.replace(/\/$/, "")}/${item.name}`;
    const { data: pub } = supabase.storage.from("memories").getPublicUrl(path);
    const rawMeta =
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : {};
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawMeta)) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text) metadata[key] = text;
    }
    out.push({
      path,
      publicUrl: pub.publicUrl,
      createdAt: item.created_at ?? null,
      metadata,
    });
  }
  return out;
}

async function fetchClientItineraries(
  clientId: number | string,
): Promise<ItineraryOption[]> {
  if (!supabase) return [];

  const key = /^\d+$/.test(String(clientId)) ? Number(clientId) : clientId;

  const [directRes, memberRes] = await Promise.all([
    supabase
      .from("itineraries")
      .select("id, title, destination")
      .eq("client_id", key)
      .or("is_template.is.null,is_template.eq.false")
      .order("id", { ascending: false }),
    supabase
      .from("itinerary_client_members")
      .select("itinerary_id, itineraries (id, title, destination, is_template)")
      .eq("client_id", key),
  ]);

  const byId = new Map<number, ItineraryOption>();

  for (const row of (directRes.data ?? []) as ItineraryOption[]) {
    if (row?.id != null) byId.set(Number(row.id), row);
  }

  for (const link of (memberRes.data ?? []) as Array<{
    itineraries?:
      | (ItineraryOption & { is_template?: boolean })
      | (ItineraryOption & { is_template?: boolean })[]
      | null;
  }>) {
    const nested = link.itineraries;
    const itinerary = Array.isArray(nested) ? nested[0] : nested;
    if (!itinerary?.id) continue;
    if (itinerary.is_template === true) continue;
    byId.set(Number(itinerary.id), {
      id: Number(itinerary.id),
      title: itinerary.title ?? null,
      destination: itinerary.destination ?? null,
    });
  }

  return [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id));
}

export default function MemoriesPage() {
  const router = useRouter();
  const [memories, setMemories] = useState<ClientMemoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [viewState, setViewState] = useState<ViewState>("clients");
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripSummary | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  /** Live approved counts from DB — never memoize stale list lengths alone */
  const [liveCountsByClient, setLiveCountsByClient] = useState<Record<string, number>>(
    {},
  );
  const [clientTrips, setClientTrips] = useState<ItineraryOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [displayPhotos, setDisplayPhotos] = useState<DisplayPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);

  const [clientItineraries, setClientItineraries] = useState<ItineraryOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<MemoryFormState>(emptyForm());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clientSummaries = useMemo((): ClientSummary[] => {
    const byClient = new Map<string, ClientSummary>();

    for (const client of clients) {
      const key = String(client.id);
      byClient.set(key, {
        id: client.id,
        name: client.name,
        // Prefer live DB count when available
        photoCount: liveCountsByClient[key] ?? 0,
        tripCount: 0,
      });
    }

    for (const memory of memories) {
      const clientId = memory.client_id;
      const key =
        clientId != null && String(clientId).trim() !== "" && clientId !== "unassigned"
          ? String(clientId)
          : UNASSIGNED_CLIENT_KEY;
      const name =
        memory.clients?.name?.trim() ||
        memory.client_name?.trim() ||
        (clientId != null && clientId !== "unassigned" ? `عميل #${clientId}` : "غير معيّن");

      if (!byClient.has(key)) {
        byClient.set(key, {
          id: clientId ?? UNASSIGNED_CLIENT_KEY,
          name,
          photoCount: liveCountsByClient[key] ?? 0,
          tripCount: 0,
        });
      }
    }

    // Apply live counts (authoritative) over any derived defaults
    for (const [key, count] of Object.entries(liveCountsByClient)) {
      const existing = byClient.get(key);
      if (existing) {
        existing.photoCount = count;
      } else if (count > 0) {
        byClient.set(key, {
          id: key === UNASSIGNED_CLIENT_KEY ? UNASSIGNED_CLIENT_KEY : key,
          name: key === UNASSIGNED_CLIENT_KEY ? "غير معيّن" : `عميل #${key}`,
          photoCount: count,
          tripCount: 0,
        });
      }
    }

    return [...byClient.values()]
      .filter((c) => c.id !== UNASSIGNED_CLIENT_KEY || c.photoCount > 0)
      .sort((a, b) => {
        if (a.id === UNASSIGNED_CLIENT_KEY) return 1;
        if (b.id === UNASSIGNED_CLIENT_KEY) return -1;
        return a.name.localeCompare(b.name, "ar");
      });
  }, [clients, memories, liveCountsByClient]);

  const tripSummaries = useMemo((): TripSummary[] => {
    if (!selectedClient) return [];

    return clientTrips.map((trip) => {
      const savedCount = memories.filter(
        (m) =>
          String(m.client_id) === String(selectedClient.id) &&
          m.itinerary_id != null &&
          String(m.itinerary_id) === String(trip.id),
      ).length;

      return {
        id: trip.id,
        title: (trip.destination || trip.title || `مسار #${trip.id}`).trim(),
        destination: trip.destination,
        photoCount: savedCount,
        pendingCount: 0,
      };
    });
  }, [clientTrips, memories, selectedClient]);

  const resetForm = useCallback(() => {
    setFormData(emptyForm());
    setClientItineraries([]);
    setSelectedFile(null);
    setFormError(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const fetchMemories = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      async function fetchLiveFromSupabase(): Promise<ClientMemoryRow[]> {
        if (!supabase) {
          throw new Error("Supabase client is not configured");
        }

        const [memoriesRes, itinerariesRes, clientsRes] = await Promise.all([
          supabase
            .from("client_memories")
            .select(
              "*",
            )
            .order("created_at", { ascending: false }),
          supabase.from("itineraries").select("id, title, destination, client_id"),
          supabase.from("clients").select("id, name"),
        ]);

        if (memoriesRes.error) throw memoriesRes.error;

        return enrichClientMemories(
          (memoriesRes.data ?? []) as Record<string, unknown>[],
          (clientsRes.data ?? []) as Array<{ id: unknown; name?: unknown }>,
          (itinerariesRes.data ?? []) as Array<{
            id: unknown;
            title?: unknown;
            destination?: unknown;
            client_id?: unknown;
          }>,
        );
      }

      // 1) Exact head counts via Server Action (authoritative for cards)
      const exact = await getExactApprovedMemoryCounts();
      if (exact.ok) {
        setLiveCountsByClient(exact.countsByClient);
        console.log("[memories-inbox] EXACT counts:", exact);
      } else {
        console.warn("[memories-inbox] exact counts failed:", exact.error);
      }

      // 2) Rows for browsing (no-store API + live supabase cross-check)
      const apiRes = await fetch(`/api/crm/client-memories?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const apiPayload = (await apiRes.json()) as {
        ok?: boolean;
        memories?: ClientMemoryRow[];
        error?: string;
      };

      let enrichedRows: ClientMemoryRow[] = [];
      if (apiRes.ok && apiPayload.ok && Array.isArray(apiPayload.memories)) {
        enrichedRows = apiPayload.memories;
      }

      try {
        const liveRows = await fetchLiveFromSupabase();
        if (enrichedRows.length !== liveRows.length || enrichedRows.length === 0) {
          enrichedRows = liveRows;
        }
      } catch (liveErr) {
        console.warn("[memories-inbox] live supabase rows failed:", liveErr);
        if (enrichedRows.length === 0) throw liveErr;
      }

      setMemories(enrichedRows);

      // Re-apply exact counts AFTER rows so nothing can overwrite with list.length
      if (exact.ok) {
        setLiveCountsByClient(exact.countsByClient);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err != null
            ? JSON.stringify(err)
            : String(err);
      setFetchError(message || "unknown_error");
      setMemories([]);
      setLiveCountsByClient({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  const goToClients = useCallback(() => {
    setViewState("clients");
    setSelectedClient(null);
    setSelectedTrip(null);
    setClientTrips([]);
    setDisplayPhotos([]);
    void (async () => {
      const exact = await getExactApprovedMemoryCounts();
      if (exact.ok) {
        setLiveCountsByClient(exact.countsByClient);
      }
      await fetchMemories();
      router.refresh();
    })();
  }, [fetchMemories, router]);

  const goToTrips = useCallback(() => {
    setViewState("trips");
    setSelectedTrip(null);
    setDisplayPhotos([]);
  }, []);

  const loadClientTrips = useCallback(async (clientId: number | string) => {
    setTripsLoading(true);
    try {
      const trips = await fetchClientItineraries(clientId);
      setClientTrips(trips);
    } catch (err) {
      console.error("[memories-inbox] trips fetch failed:", err);
      setClientTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }, []);

  const loadTripPhotos = useCallback(
    async (clientId: number | string, tripId: number | string) => {
      if (!supabase) return;
      setPhotosLoading(true);
      try {
        // Fresh DB read — avoid stale React closure after delete
        const tripKey = /^\d+$/.test(String(tripId)) ? Number(tripId) : tripId;
        const clientKey =
          clientId === UNASSIGNED_CLIENT_KEY
            ? null
            : /^\d+$/.test(String(clientId))
              ? Number(clientId)
              : clientId;

        let savedQuery = supabase
          .from("client_memories")
          .select("*")
          .eq("itinerary_id", tripKey)
          .order("created_at", { ascending: false });

        if (clientKey != null) {
          savedQuery = savedQuery.eq("client_id", clientKey);
        }

        const { data: savedRows, error: savedError } = await savedQuery;
        if (savedError) {
          console.warn("[memories-inbox] saved memories fetch:", savedError.message);
        }

        const saved = (savedRows ?? []) as ClientMemoryRow[];

        const savedUrlKeys = new Set(
          saved.map((m) => normalizeUrlKey(String(m.image_url ?? ""))).filter(Boolean),
        );
        const savedNames = new Set(
          saved
            .map((m) => {
              try {
                return fileNameFromPath(new URL(String(m.image_url)).pathname);
              } catch {
                return fileNameFromPath(String(m.image_url ?? ""));
              }
            })
            .filter(Boolean),
        );

        // Storage layout from Magic Link / API:
        //   {clientId}/{file}  or  inbox/{tripId}/{file}
        const [byClient, byInbox] = await Promise.all([
          clientKey != null ? listStorageImages(String(clientKey)) : Promise.resolve([]),
          listStorageImages(`inbox/${tripId}`),
        ]);

        const pendingMap = new Map<string, DisplayPhoto>();
        for (const file of [...byClient, ...byInbox]) {
          const urlKey = normalizeUrlKey(file.publicUrl);
          const name = fileNameFromPath(file.path);
          if (savedUrlKeys.has(urlKey) || savedNames.has(name)) continue;
          const metaLocation =
            file.metadata.locationName ||
            file.metadata.location_name ||
            null;
          const metaMapUrl =
            file.metadata.mapUrl ||
            file.metadata.map_url ||
            file.metadata.google_maps_url ||
            null;
          pendingMap.set(file.path, {
            key: `pending:${file.path}`,
            image_url: file.publicUrl,
            status: "pending",
            storagePath: file.path,
            location_name: metaLocation || "معلق — بانتظار الاعتماد",
            map_url: metaMapUrl,
            created_at: file.createdAt,
          });
        }

        const savedDisplay: DisplayPhoto[] = saved.map((photo) => ({
          key: `saved:${photo.id}`,
          image_url: photo.image_url,
          status: "saved" as const,
          dbId: photo.id,
          storagePath: toBucketRelativePath(photo.image_url) ?? undefined,
          location_name: photo.location_name || photo.location || null,
          map_url: photo.map_url ?? null,
          created_at: photo.created_at ?? null,
        }));

        setDisplayPhotos([...pendingMap.values(), ...savedDisplay]);
      } catch (err) {
        console.error("[memories-inbox] photos load failed:", err);
        setDisplayPhotos([]);
      } finally {
        setPhotosLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name", { ascending: true });
      if (!error && data) {
        setClients(
          (data as ClientOption[]).filter(
            (client) => client.id != null && String(client.name ?? "").trim().length > 0,
          ),
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !formData.client_id.trim()) {
      setClientItineraries([]);
      return;
    }

    void (async () => {
      const trips = await fetchClientItineraries(formData.client_id);
      setClientItineraries(trips);
    })();
  }, [formData.client_id]);

  useEffect(() => {
    if (viewState === "photos" && selectedClient && selectedTrip) {
      void loadTripPhotos(selectedClient.id, selectedTrip.id);
    }
  }, [viewState, selectedClient, selectedTrip, loadTripPhotos]);

  const handleApprovePending = async (photo: DisplayPhoto) => {
    if (!supabase || !selectedClient || !selectedTrip || photo.status !== "pending") {
      return;
    }
    if (selectedClient.id === UNASSIGNED_CLIENT_KEY) {
      window.alert("تعذر الاعتماد — اختر عميلاً مرتبطاً أولاً.");
      return;
    }

    setApprovingKey(photo.key);
    try {
      const clientKey = /^\d+$/.test(String(selectedClient.id))
        ? Number(selectedClient.id)
        : selectedClient.id;
      const tripKey = /^\d+$/.test(String(selectedTrip.id))
        ? Number(selectedTrip.id)
        : selectedTrip.id;

      let locationName =
        photo.location_name?.trim() &&
        photo.location_name !== "معلق — بانتظار الاعتماد"
          ? photo.location_name.trim()
          : "";
      let mapUrl = photo.map_url?.trim() || "";

      // Resolve real Google Maps URL + place name from the trip's days_data stops
      if (supabase && (!mapUrl || !locationName)) {
        const { data: tripRow } = await supabase
          .from("itineraries")
          .select("destination, days_data")
          .eq("id", tripKey)
          .maybeSingle();

        const daysData = (tripRow as { days_data?: unknown } | null)?.days_data;
        const destination = String(
          (tripRow as { destination?: unknown } | null)?.destination ?? "",
        ).trim();

        const walk = (node: unknown): void => {
          if (!node || (locationName && mapUrl)) return;
          if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
          }
          if (typeof node !== "object") return;
          const obj = node as Record<string, unknown>;
          const place = String(
            obj.place_name ?? obj.title ?? obj.name ?? "",
          ).trim();
          const url = String(
            obj.google_maps_url ?? obj.maps_url ?? obj.map_url ?? "",
          ).trim();
          if (!locationName && place && place !== "محطة" && place !== "محطة مختارة") {
            locationName = place;
          }
          if (!mapUrl && /^https?:\/\//i.test(url)) {
            mapUrl = url;
          }
          // Prefer matching place if we already have a location name
          if (
            locationName &&
            place &&
            place.toLowerCase() === locationName.toLowerCase() &&
            /^https?:\/\//i.test(url)
          ) {
            mapUrl = url;
          }
          for (const value of Object.values(obj)) walk(value);
        };
        walk(daysData);

        if (!locationName && destination) locationName = destination;
      }

      if (!locationName) locationName = "محطة مختارة";

      const insertPayload: Record<string, unknown> = {
        client_id: clientKey,
        itinerary_id: tripKey,
        image_url: photo.image_url,
        location_name: locationName,
        location: locationName,
        caption: null,
      };
      if (mapUrl && /^https?:\/\//i.test(mapUrl)) {
        insertPayload.map_url = mapUrl;
      }

      const { error } = await supabase.from("client_memories").insert(insertPayload);

      if (error) throw error;

      await fetchMemories();
      await loadTripPhotos(selectedClient.id, selectedTrip.id);
      window.alert("تم اعتماد الصورة وربطها بالمسار بنجاح.");
    } catch (err) {
      console.error("[memories-inbox] approve failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err != null
            ? JSON.stringify(err)
            : String(err);
      window.alert(`تعذر اعتماد الصورة:\n${message}`);
    } finally {
      setApprovingKey(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const selectedClientOption = clients.find(
      (client) => String(client.id) === formData.client_id.trim(),
    );

    if (!selectedClientOption?.id) {
      setFormError("الرجاء اختيار العميل قبل رفع الذكرى.");
      return;
    }

    if (!selectedFile) {
      setFormError("الرجاء إرفاق صورة قبل الحفظ");
      return;
    }

    setSaving(true);
    setFormError(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `crm/client-${selectedClientOption.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(filePath, selectedFile, {
        contentType: selectedFile.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      setFormError(uploadError.message || "تعذر رفع الصورة. حاول مرة أخرى.");
      setSaving(false);
      return;
    }

    const { data: publicData } = supabase.storage.from("memories").getPublicUrl(filePath);
    const uploadedFileUrl = publicData.publicUrl;
    const memoryCaption = formData.client_review.trim() || null;

    const { error } = await supabase.from("client_memories").insert({
      client_id: selectedClientOption.id,
      image_url: uploadedFileUrl,
      caption: memoryCaption,
      itinerary_id: formData.itinerary_id.trim() ? Number(formData.itinerary_id) : null,
      location_name: formData.location_name.trim() || null,
      location: formData.location_name.trim() || null,
    });

    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }

    closeModal();
    goToClients();
    void fetchMemories();
    setSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFormError(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const handleEditPhoto = async (photo: DisplayPhoto) => {
    if (!supabase || photo.status !== "saved" || photo.dbId == null) return;

    const newLocationName = window.prompt(
      "تعديل اسم المحطة:",
      photo.location_name || "",
    );

    if (
      !newLocationName ||
      newLocationName.trim() === "" ||
      newLocationName.trim() === (photo.location_name || "").trim()
    ) {
      return;
    }

    const trimmedName = newLocationName.trim();

    try {
      const { error } = await supabase
        .from("client_memories")
        .update({ location_name: trimmedName, location: trimmedName })
        .eq("id", photo.dbId);

      if (error) throw error;

      setDisplayPhotos((prev) =>
        prev.map((p) =>
          p.key === photo.key ? { ...p, location_name: trimmedName } : p,
        ),
      );
      setMemories((prev) =>
        prev.map((memory) =>
          memory.id === photo.dbId
            ? { ...memory, location_name: trimmedName, location: trimmedName }
            : memory,
        ),
      );
    } catch (error) {
      console.error("Edit error:", error);
      window.alert("حدث خطأ أثناء التعديل.");
    }
  };

  const handleDeletePhoto = async (photo: DisplayPhoto) => {
    if (!supabase) return;

    const confirmDelete = window.confirm("هل أنت متأكد من رغبتك في حذف هذه الصورة نهائياً؟");
    if (!confirmDelete) return;

    try {
      const relativePath =
        toBucketRelativePath(photo.storagePath) ||
        toBucketRelativePath(photo.image_url);

      // ── Approved: Server Action dual-delete + revalidatePath + router.refresh ──
      if (photo.status === "saved") {
        if (photo.dbId == null) {
          window.alert("تعذر الحذف — معرّف السجل غير موجود.");
          return;
        }

        console.log("[memories-inbox] server-action dual-delete:", {
          memoryId: photo.dbId,
          path: relativePath,
        });

        const result = await deleteApprovedClientMemory({
          memoryId: photo.dbId,
          path: relativePath,
          url: photo.image_url,
        });

        if (!result.ok) {
          console.error("[memories-inbox] approved delete failed:", result);
          throw new Error(result.error || "فشل حذف الصورة المعتمدة");
        }

        if (result.warning) {
          console.warn("[memories-inbox] approved delete warning:", result.warning);
        }

        // Exact count from DB after delete — never decrement locally
        const clientKey = result.clientId
          ? String(result.clientId)
          : selectedClient
            ? String(selectedClient.id)
            : null;

        if (clientKey != null && typeof result.exactCount === "number") {
          setLiveCountsByClient((prev) => ({
            ...prev,
            [clientKey]: result.exactCount!,
          }));
        }

        setMemories((prev) => prev.filter((memory) => memory.id !== photo.dbId));
        setDisplayPhotos((prev) => prev.filter((p) => p.key !== photo.key));

        // Force Next.js + client tree to drop any cached RSC payload
        router.refresh();
        await fetchMemories();

        if (selectedClient && selectedTrip) {
          await loadTripPhotos(selectedClient.id, selectedTrip.id);
        }
        return;
      }

      // ── Pending: storage-only delete ─────────────────────────────────────
      if (!relativePath) {
        console.error("[memories-inbox] delete missing storage path", photo);
        window.alert("تعذر تحديد مسار الملف في التخزين.");
        return;
      }

      console.log("[memories-inbox] deleting pending storage path:", relativePath);

      const res = await fetch("/api/crm/memories-storage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: relativePath, url: photo.image_url }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        console.error("[memories-inbox] storage remove failed:", payload);
        throw new Error(
          payload.error || `فشل حذف الملف من التخزين (المسار: ${relativePath})`,
        );
      }

      setDisplayPhotos((prev) => prev.filter((p) => p.key !== photo.key));
      if (selectedClient && selectedTrip) {
        await loadTripPhotos(selectedClient.id, selectedTrip.id);
      }
    } catch (error) {
      console.error("Delete error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error != null
            ? JSON.stringify(error)
            : String(error);
      window.alert(`حدث خطأ أثناء الحذف:\n${message}`);

      // Re-sync counts + grid with server truth
      await fetchMemories();
      if (selectedClient && selectedTrip) {
        void loadTripPhotos(selectedClient.id, selectedTrip.id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans" dir="rtl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold text-gray-900">
            مكتبة ذكريات العملاء 📸
          </h1>
          <p className="text-gray-500">
            صندوق الوارد: رحلات العميل + صور معلّقة من التخزين + اعتماد الإدارة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchMemories()}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 shadow-sm transition hover:border-[#D4AF37]/40"
          >
            تحديث العدّاد
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#1E2720] px-6 py-3 font-bold text-[#D4AF37] shadow-lg transition hover:bg-[#2a362c]"
          >
            <span>➕</span> إضافة ذكرى يدوياً
          </button>
        </div>
      </div>

      <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-600">
        <button
          type="button"
          onClick={goToClients}
          className={`transition hover:text-[#B5914F] ${viewState === "clients" ? "text-[#1E2720]" : ""}`}
        >
          العملاء
        </button>
        {viewState !== "clients" && selectedClient ? (
          <>
            <span className="text-gray-300">/</span>
            <button
              type="button"
              onClick={goToTrips}
              className={`transition hover:text-[#B5914F] ${viewState === "trips" ? "text-[#1E2720]" : ""}`}
            >
              {selectedClient.name}
            </button>
          </>
        ) : null}
        {viewState === "photos" && selectedTrip ? (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-[#1E2720]">{selectedTrip.title}</span>
          </>
        ) : null}
      </nav>

      {fetchError ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          {fetchError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center p-16">
          <p className="font-bold text-[#B5914F]">جاري جلب الذكريات...</p>
        </div>
      ) : viewState === "clients" ? (
        clientSummaries.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {clientSummaries.map((client) => (
              <button
                key={String(client.id)}
                type="button"
                onClick={() => {
                  setSelectedClient(client);
                  setSelectedTrip(null);
                  setViewState("trips");
                  void loadClientTrips(client.id);
                }}
                className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:border-[#D4AF37]/40 hover:shadow-md"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFFBF0] text-2xl">
                  👤
                </div>
                <h3 className="text-xl font-bold text-gray-900">{client.name}</h3>
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  {liveCountsByClient[String(client.id)] ?? client.photoCount} صورة معتمدة
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
            <div className="mb-4 text-6xl">📭</div>
            <h3 className="text-xl font-bold text-[#1A2521]">لا يوجد عملاء بعد</h3>
            <p className="mt-2 text-sm text-gray-500">
              أضف عميلاً من CRM أو ارفع ذكرى يدوياً من الزر أعلاه.
            </p>
          </div>
        )
      ) : viewState === "trips" && selectedClient ? (
        tripsLoading ? (
          <div className="flex justify-center p-16">
            <p className="font-bold text-[#B5914F]">جاري جلب رحلات العميل...</p>
          </div>
        ) : tripSummaries.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {tripSummaries.map((trip) => (
              <button
                key={String(trip.id)}
                type="button"
                onClick={() => {
                  setSelectedTrip(trip);
                  setViewState("photos");
                }}
                className="rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#FFFBF0] to-white p-6 text-center shadow-sm transition hover:border-[#D4AF37]/50 hover:shadow-md"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                  ✈️
                </div>
                <h3 className="text-lg font-bold text-gray-900">{trip.title}</h3>
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  {trip.photoCount} صورة معتمدة في قاعدة البيانات
                </p>
                <p className="mt-1 text-xs font-bold text-[#B5914F]">
                  افتح لعرض المعلّق من التخزين
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="font-bold text-gray-700">
              لا توجد رحلات مربوطة بهذا العميل بعد. اربط المسار بالعميل من منشئ الرحلة.
            </p>
            <button
              type="button"
              onClick={goToClients}
              className="mt-4 text-sm font-bold text-[#B5914F] hover:underline"
            >
              العودة إلى العملاء
            </button>
          </div>
        )
      ) : viewState === "photos" && selectedClient && selectedTrip ? (
        photosLoading ? (
          <div className="flex justify-center p-16">
            <p className="font-bold text-[#B5914F]">جاري مزامنة التخزين مع قاعدة البيانات...</p>
          </div>
        ) : displayPhotos.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {displayPhotos.map((photo) => {
              const locationLabel = photo.location_name || "بدون موقع";
              const canSearchMaps =
                photo.status === "saved" &&
                locationLabel.trim() !== "" &&
                locationLabel !== "بدون موقع" &&
                !locationLabel.includes("معلق");

              return (
                <article
                  key={photo.key}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
                    photo.status === "pending"
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : "border-gray-100"
                  }`}
                >
                  <div className="relative">
                    {photo.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.image_url}
                        alt={locationLabel}
                        className="h-48 w-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fallback = el.nextElementSibling;
                          if (fallback instanceof HTMLElement) {
                            fallback.classList.remove("hidden");
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`flex h-48 items-center justify-center bg-gray-100 text-sm text-gray-400 ${
                        photo.image_url ? "hidden" : ""
                      }`}
                    >
                      {photo.status === "saved"
                        ? "الصورة غير متوفرة في التخزين"
                        : "لا توجد صورة"}
                    </div>
                    {photo.status === "pending" ? (
                      <span className="absolute start-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black text-white shadow">
                        معلق
                      </span>
                    ) : (
                      <span className="absolute start-3 top-3 rounded-full bg-[#1E2720] px-3 py-1 text-[10px] font-black text-[#D4AF37] shadow">
                        معتمد
                      </span>
                    )}
                  </div>
                  <div className="flex flex-grow flex-col justify-between p-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between rtl:flex-row-reverse">
                        <p className="flex-1 text-right font-medium text-gray-900">
                          {locationLabel}
                        </p>
                        {canSearchMaps ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-2 cursor-pointer text-lg transition-all hover:scale-110 hover:opacity-80"
                            title="بحث في خرائط جوجل"
                          >
                            📍
                          </a>
                        ) : null}
                      </div>
                      {photo.created_at ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(photo.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3">
                      {photo.status === "pending" ? (
                        <button
                          type="button"
                          disabled={approvingKey === photo.key}
                          onClick={() => void handleApprovePending(photo)}
                          className="w-full rounded-lg bg-[#1E2720] py-2 text-sm font-bold text-[#D4AF37] transition hover:bg-black disabled:opacity-60"
                        >
                          {approvingKey === photo.key ? "جاري الاعتماد…" : "اعتماد الصورة"}
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleEditPhoto(photo)}
                            className="flex-1 rounded-lg bg-gray-100 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeletePhoto(photo)}
                            className="flex-1 rounded-lg bg-red-50 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                          >
                            حذف
                          </button>
                        </div>
                      )}
                      {photo.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => void handleDeletePhoto(photo)}
                          className="w-full rounded-lg bg-red-50 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          حذف من التخزين
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="font-bold text-gray-700">
              لا توجد صور معتمدة أو معلّقة لهذه الرحلة في التخزين.
            </p>
            <button
              type="button"
              onClick={goToTrips}
              className="mt-4 text-sm font-bold text-[#B5914F] hover:underline"
            >
              العودة إلى الرحلات
            </button>
          </div>
        )
      ) : null}

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          dir="rtl"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-[#D4AF37]/20 bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 border-b border-gray-100 pb-5">
              <h2 className="text-2xl font-bold text-gray-900">توثيق ذكرى عميل ✍️</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                اختر العميل أولاً — تُربط الصورة مباشرةً بملفه الشخصي في بوابة VIP.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  العميل <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={FIELD_CLASS}
                  value={formData.client_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      client_id: e.target.value,
                      itinerary_id: "",
                    })
                  }
                >
                  <option value="">اختر العميل…</option>
                  {clients.map((client) => (
                    <option key={client.id} value={String(client.id)}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  المسار / الرحلة (اختياري)
                </label>
                <select
                  className={FIELD_CLASS}
                  value={formData.itinerary_id}
                  onChange={(e) => {
                    const itineraryId = e.target.value;
                    const selectedItinerary = clientItineraries.find(
                      (itinerary) => String(itinerary.id) === itineraryId,
                    );
                    const suggestedLocation =
                      selectedItinerary?.destination?.trim() ||
                      selectedItinerary?.title?.trim() ||
                      "";

                    setFormData((prev) => ({
                      ...prev,
                      itinerary_id: itineraryId,
                      location_name:
                        prev.location_name.trim() || suggestedLocation || prev.location_name,
                    }));
                  }}
                  disabled={!formData.client_id || clientItineraries.length === 0}
                >
                  <option value="">بدون ربط بمسار محدد</option>
                  {clientItineraries.map((itinerary) => (
                    <option key={itinerary.id} value={String(itinerary.id)}>
                      {(itinerary.destination || itinerary.title || `مسار #${itinerary.id}`).trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  اسم الموقع / المحطة
                </label>
                <input
                  type="text"
                  placeholder="مثال: برج طوكيو"
                  className={FIELD_CLASS}
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  رأي العميل (التعليق)
                </label>
                <textarea
                  rows={4}
                  placeholder="اكتب نص التقييم أو المحادثة هنا…"
                  className={`${FIELD_CLASS} resize-y`}
                  value={formData.client_review}
                  onChange={(e) => setFormData({ ...formData, client_review: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  إرفاق صورة <span className="text-red-500">*</span>
                </label>
                <label
                  className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
                    selectedFile
                      ? "border-[#D4AF37]/60 bg-[#D4AF37]/5"
                      : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                  } ${imagePreview ? "h-auto min-h-[8rem] p-3" : "h-32"}`}
                >
                  {imagePreview ? (
                    <div className="flex w-full flex-col items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="معاينة الصورة"
                        className="h-40 w-full rounded-lg border border-gray-200 object-cover"
                      />
                      <p className="text-center text-sm font-semibold text-gray-700">
                        {selectedFile?.name}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-5">
                      <p className="mb-1 text-sm font-semibold text-gray-600">اضغط هنا لرفع الصورة</p>
                      <p className="text-xs text-gray-400">JPG · PNG · WebP · GIF</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                  {formError}
                </div>
              ) : null}

              <div className="flex gap-3 border-t border-gray-100 pt-2">
                <button
                  type="submit"
                  disabled={!selectedFile || saving}
                  className="flex-1 rounded-xl bg-[#1E2720] py-3 text-sm font-bold text-[#D4AF37] transition hover:bg-[#2a362c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "جاري الحفظ…" : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
