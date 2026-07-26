'use client';

export type PortalSection = 'itinerary';

type VipPortalTopNavProps = {
  active: PortalSection;
  onChange: (section: PortalSection) => void;
};

export default function VipPortalTopNav(_props: VipPortalTopNavProps) {
  return null;
}
