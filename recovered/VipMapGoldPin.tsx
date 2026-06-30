type VipMapGoldPinProps = {
  order: number
  pulse?: boolean
  selected?: boolean
}

export default function VipMapGoldPin({ order, pulse = false, selected = false }: VipMapGoldPinProps) {
  return (
    <button
      type="button"
      className={`vip-map-pin flex cursor-pointer items-center justify-center border-2 border-[#001f3f] bg-[#d4af37] text-[#001f3f] shadow-[0_0_12px_rgba(212,175,55,0.55)] transition-transform ${
        pulse ? 'vip-map-pin--pulse' : ''
      } ${selected ? 'scale-110 ring-2 ring-white/40' : 'hover:scale-105'}`}
      style={{ width: 36, height: 36, borderRadius: 9999, fontSize: 13, fontWeight: 800 }}
      aria-label={`${order}`}
    >
      {order}
    </button>
  )
}
