'use client';

import BoardingFlightFieldsPanel, {
  type BoardingFlightFieldsValue,
} from '@/app/crm/itineraries/_components/BoardingFlightFieldsPanel';
import {
  type FlightDetailsDraft,
} from '@/lib/itinerary-builder-model';

type Props = {
  flight: FlightDetailsDraft;
  onChange: (flight: FlightDetailsDraft) => void;
};

function toPanelValue(flight: FlightDetailsDraft): BoardingFlightFieldsValue {
  return {
    originCity: flight.flight_from,
    departureCountry: flight.departure_country,
    flightArrivalCity: flight.flight_to,
    arrivalCountry: flight.arrival_country,
    flightNumber: flight.flight_number,
    pnr: flight.booking_reference,
    flightClass: flight.flight_class,
    departureTime: flight.departure_time || flight.flight_time,
    arrivalTime: flight.arrival_time,
    terminal: flight.terminal,
    gate: flight.gate,
    seat: flight.flight_seat,
  };
}

function applyPanelPatch(
  flight: FlightDetailsDraft,
  patch: Partial<BoardingFlightFieldsValue>,
): FlightDetailsDraft {
  const next = { ...flight };
  if (patch.originCity !== undefined) next.flight_from = patch.originCity;
  if (patch.departureCountry !== undefined) next.departure_country = patch.departureCountry;
  if (patch.flightArrivalCity !== undefined) next.flight_to = patch.flightArrivalCity;
  if (patch.arrivalCountry !== undefined) next.arrival_country = patch.arrivalCountry;
  if (patch.flightNumber !== undefined) next.flight_number = patch.flightNumber;
  if (patch.pnr !== undefined) next.booking_reference = patch.pnr;
  if (patch.flightClass !== undefined) next.flight_class = patch.flightClass;
  if (patch.departureTime !== undefined) {
    next.departure_time = patch.departureTime;
    next.flight_time = patch.departureTime;
  }
  if (patch.arrivalTime !== undefined) next.arrival_time = patch.arrivalTime;
  if (patch.terminal !== undefined) next.terminal = patch.terminal;
  if (patch.gate !== undefined) next.gate = patch.gate;
  if (patch.seat !== undefined) next.flight_seat = patch.seat;
  return next;
}

export default function ItineraryBoardingDetailsForm({ flight, onChange }: Props) {
  return (
    <div className="space-y-3">
      <BoardingFlightFieldsPanel
        value={toPanelValue(flight)}
        onChange={(patch) => onChange(applyPanelPatch(flight, patch))}
        title="بيانات البوردينق"
        subtitle="Boarding Details — تظهر فوراً في بطاقة صعود العميل"
        datalistId="split-editor-flight-arrival-city"
      />
      <p className="px-1 text-[10px] font-medium text-[#1E2720]/45">
        يُحفظ في <span className="font-mono">flight_details</span> عند «حفظ المسار».
      </p>
    </div>
  );
}
