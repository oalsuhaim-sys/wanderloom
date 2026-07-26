import type { ClientItineraryBridge } from '@/lib/client-active-itinerary';

export type ClientProfileSummary = {
  id: string | number;
  name: string;
  vipTier: string | null;
  referralCode: string | null;
  passportExpiry: string | null;
  walletBalance: number;
  /** Sum of amount paid (ما تم دفعه). */
  totalSpent: number;
  /** Total trip/booking cost (إجمالي تكلفة الرحلة). */
  totalTripCost: number;
  /** Outstanding: totalTripCost − totalSpent (never negative). */
  remainingBalance: number;
  tripsCount: number;
};

export type ClientMemory = {
  id: string;
  clientId: string | number | null;
  itineraryId: string | null;
  title: string | null;
  caption: string | null;
  location: string | null;
  locationName: string | null;
  imageUrl: string | null;
  memoryDate: string | null;
  /** Trip destination / city from linked itinerary */
  destination?: string | null;
  /** Itinerary / trip display name */
  tripName?: string | null;
  /** Explicit Google Maps / location link when stored on the row */
  mapUrl?: string | null;
  /** Resolved station / place name (from stop or places bank) */
  stationName?: string | null;
  /** Resolved city for the station */
  city?: string | null;
  /** places.id when linked via places_bank_id on the stop */
  placeId?: string | null;
};

export type ClientProfileDashboardPayload = {
  ok: true;
  client: ClientProfileSummary;
  trips: ClientItineraryBridge[];
  activeTrip: ClientItineraryBridge | null;
  pastTrips: ClientItineraryBridge[];
  memories: ClientMemory[];
};
