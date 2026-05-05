'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Star, Clock, MapPin, Lock, Send, X, Map, List, ChevronDown, MessageCircle, Sparkles, Navigation2 } from 'lucide-react'

const CATEGORIES: Record<string, {label:string, icon:string, color:string, bg:string}> = {
  l: { label:'معلم', icon:'🏛️', color:'#1565C0', bg:'#DBEAFE' },
  r: { label:'مطعم', icon:'🍽️', color:'#EA580C', bg:'#FFF7ED' },
  c: { label:'كافيه', icon:'☕', color:'#92400E', bg:'#FEF3C7' },
  s: { label:'تسوق', icon:'🛍️', color:'#9C27B0', bg:'#F3E8FF' },
  d: { label:'تجربة', icon:'🎭', color:'#7C3AED', bg:'#EDE9FE' },
  h: { label:'فندق', icon:'🏨', color:'#0891B2', bg:'#ECFEFF' },
  o: { label:'أخرى', icon:'🧭', color:'#6B7280', bg:'#F3F4F6' },
}

const TRANSIT: Record<string, {label:string, icon:string, color:string}> = {
  walk:   { label:'مشياً',  icon:'🚶', color:'#16A34A' },
  subway: { label:'مترو',   icon:'🚇', color:'#7C3AED' },
  car:    { label:'سيارة',  icon:'🚗', color:'#EA580C' },
  bus:    { label:'باص',    icon:'🚌', color:'#0891B2' },
}

export default function PortalPageClient() {
  const [code, setCode] = useState('')
  const [journey, setJourney] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [day, setDay] = useState(0)
  const [view, setView] = useState<'list'|'map'>('list')
  const [detail, setDetail] = useState<any>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markers = useRef<any[]>([])

  // Check URL for passcode
  useEffect(() => {
    const path = window.location.pathname.split('/').pop()
    if (path && path.startsWith('WL-')) {
      setCode(path)
      doLogin(path)
    }
  }, [])

  const doLogin = async (passcode: string) => {
    setLoading(true); setError('')
    const pc = passcode.trim().toUpperCase()
    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.')
      setJourney(null)
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('itineraries')
      .select(`
        *, 
        clients!inner(name, client_preferences(*)),
        itinerary_days(*, itinerary_stops(*))
      `)
      .eq('passcode', pc)
      .single()

    if (err || !data) {
      setError('الرمز غير صحيح، يرجى التأكد من مفتاح الرحلة')
      setJourney(null)
      setLoading(false)
      return
    }

    if (String(data.status || '') === 'archived') {
      setError('هذا المسار متوقف حالياً')
      setJourney(null)
      setLoading(false)
      return
    }

    // Sort days and stops
    data.itinerary_days?.sort((a:any,b:any) => a.sort_order - b.sort_order)
    data.itinerary_days?.forEach((d:any) => d.itinerary_stops?.sort((a:any,b:any) => a.sort_order - b.sort_order))
    setJourney(data)
    setLoading(false)
  }

  // Leaflet map
  useEffect(() => {
    markers.current.forEach((m: any) => {
      if (m && typeof m.remove === 'function') m.remove()
    })
    markers.current = []

    if (view !== 'map' || !journey) return
    const days = journey.itinerary_days
    if (!days?.[day]) return

    let cancelled = false
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null
    let postInvalidateTimer: ReturnType<typeof setTimeout> | null = null

    const clearMapLayers = () => {
      markers.current.forEach((m: any) => {
        if (m && typeof m.remove === 'function') m.remove()
      })
      markers.current = []
    }

    const loadLeaflet = async () => {
      if (!(window as any).L) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(link)
        await new Promise<void>(resolve => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
          s.onload = () => resolve()
          document.head.appendChild(s)
        })
      }

      const L = (window as any).L
      if (!mapRef.current) return

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, { scrollWheelZoom: true, zoomControl: true })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance.current)
      }
      if (cancelled) return

      mapInstance.current.invalidateSize({ animate: false })
      invalidateTimer = setTimeout(() => {
        if (cancelled || !mapInstance.current) return
        mapInstance.current.invalidateSize({ animate: false })
      }, 0)

      const stops = days[day].itinerary_stops || []
      
      // For now use approximate coordinates based on stop index
      const cityCoords: Record<string,number[]> = {
        'إدنبرة': [55.9533, -3.1883],
        'هايلاندز': [56.8198, -5.1052],
        'طوكيو': [35.6762, 139.6503],
        'سيول': [37.5665, 126.9780],
      }
      const center = cityCoords[days[day].city] || [55.95, -3.19]
      const dayColor = days[day].color || '#2563EB'

      stops.forEach((stop:any, i:number) => {
        const angle = (i / (stops.length || 1)) * 2 * Math.PI
        const spread = 0.005 + i * 0.002
        const lat = center[0] + Math.sin(angle) * spread
        const lng = center[1] + Math.cos(angle) * spread

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:34px;height:34px;border-radius:50%;background:${dayColor};border:3px solid #fff;box-shadow:0 3px 14px ${dayColor}55;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900">${i+1}</div>`,
          iconSize: [34, 34], iconAnchor: [17, 17],
        })

        const m = L.marker([lat, lng], { icon }).addTo(mapInstance.current)
        m.bindPopup(`<div style="direction:rtl;text-align:right;font-family:sans-serif;min-width:140px;padding:4px"><b style="color:${dayColor};font-size:14px">${stop.place_name}</b><br><span style="font-size:11px;color:#6B7280">${CATEGORIES[stop.category]?.icon || '📍'} ${CATEGORIES[stop.category]?.label || ''}</span>${stop.time_slot ? `<br><span style="font-size:10px;color:#9CA3AF">🕐 ${stop.time_slot}</span>` : ''}</div>`)
        markers.current.push(m)
      })

      mapInstance.current.invalidateSize()

      if (stops.length > 0) {
        const allCoords = stops.map((_:any, i:number) => {
          const angle = (i / (stops.length || 1)) * 2 * Math.PI
          const spread = 0.005 + i * 0.002
          return [center[0] + Math.sin(angle) * spread, center[1] + Math.cos(angle) * spread]
        })
        if (allCoords.length > 1) {
          const polyline = L.polyline(allCoords, { color: dayColor, weight: 3, opacity: 0.6, dashArray: '8 12' }).addTo(mapInstance.current)
          markers.current.push(polyline)
          mapInstance.current.fitBounds(L.latLngBounds(allCoords).pad(0.2), { maxZoom: 15 })
        } else {
          mapInstance.current.setView(allCoords[0], 14)
        }
      } else {
        mapInstance.current.setView(center, 12)
      }

      mapInstance.current.invalidateSize()

      postInvalidateTimer = setTimeout(() => {
        if (cancelled || !mapInstance.current) return
        mapInstance.current.invalidateSize({ animate: false })
      }, 200)
    }

    loadLeaflet()
    return () => {
      cancelled = true
      if (invalidateTimer) clearTimeout(invalidateTimer)
      if (postInvalidateTimer) clearTimeout(postInvalidateTimer)
      clearMapLayers()
    }
  }, [view, day, journey])

  // ═══ GATE SCREEN ═══
  if (!journey) {
    return (
      <div dir="rtl" style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07100D', fontFamily:'sans-serif', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,rgba(28,69,50,.4),transparent 65%)', top:-220, right:-220, filter:'blur(70px)' }} />
        <div style={{ position:'relative', zIndex:2, width:'min(420px,90vw)', textAlign:'center' }}>
          <h1 style={{ fontSize:56, fontWeight:300, color:'#E8C96A', letterSpacing:10, margin:0 }}>Wander</h1>
          <h1 style={{ fontSize:56, fontWeight:600, color:'#C9A84C', letterSpacing:10, margin:0, fontStyle:'italic' }}>loom</h1>
          <div style={{ display:'flex', alignItems:'center', gap:14, margin:'26px 0' }}>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,rgba(201,168,76,.35))' }} />
            <div style={{ width:7, height:7, background:'#C9A84C', transform:'rotate(45deg)' }} />
            <div style={{ flex:1, height:1, background:'linear-gradient(270deg,transparent,rgba(201,168,76,.35))' }} />
          </div>
          <p style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:20 }}>أدخل مفتاح رحلتك الخاص</p>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && doLogin(code)}
            placeholder="WL-XXXX-XX"
            style={{ width:'100%', padding:16, background:'rgba(255,255,255,.04)', border:'1.5px solid rgba(201,168,76,.2)', borderRadius:14, color:'#E8C96A', fontSize:18, textAlign:'center', letterSpacing:4, outline:'none', fontWeight:700 }}
          />
          {error && <p style={{ color:'#F87171', fontSize:12, marginTop:10 }}>{error}</p>}
          <button onClick={() => doLogin(code)} disabled={loading || !code.trim()}
            style={{ width:'100%', marginTop:14, padding:16, border:'none', borderRadius:14, background:'linear-gradient(135deg,#8A6B2A,#C9A84C)', color:'#1C4532', fontSize:15, fontWeight:900, cursor:'pointer', letterSpacing:2, opacity: loading ? 0.5 : 1 }}>
            {loading ? 'جارٍ الفتح...' : '🔐 فتح مساري'}
          </button>
          <p style={{ marginTop:36, fontSize:8, color:'rgba(255,255,255,.1)', letterSpacing:4 }}>WANDERLOOM · PRIVATE & CONFIDENTIAL</p>
        </div>
      </div>
    )
  }

  // ═══ PORTAL SCREEN ═══
  const days = journey.itinerary_days || []
  const currentDay = days[day]
  const stops = currentDay?.itinerary_stops || []
  const clientName = journey.clients?.name || ''

  return (
    <div dir="rtl" style={{ background:'#F6F4F0', minHeight:'100vh', fontFamily:'sans-serif', paddingBottom:100 }}>

      {/* Header */}
      <header style={{ background:'linear-gradient(160deg,#07100D,#0F1E16)', padding:'16px 20px', position:'sticky', top:0, zIndex:100, boxShadow:'0 4px 40px rgba(0,0,0,.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:600, color:'#C9A84C', letterSpacing:6 }}>Wanderloom</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', marginTop:2 }}>مرحباً {clientName} ✦</div>
          </div>
          <span style={{ fontSize:7.5, color:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.1)', padding:'4px 12px', borderRadius:24, letterSpacing:2 }}>● PRIVATE</span>
        </div>
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:15, color:'#fff', fontWeight:800 }}>✈️ {journey.title}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:3 }}>{journey.dates}</div>
        </div>
      </header>

      {/* Day Tabs */}
      <div style={{ display:'flex', gap:8, padding:'12px 16px', overflowX:'auto', borderBottom:'1px solid #E8E4DC', position:'sticky', top:88, zIndex:90, background:'#F6F4F0' }}>
        {days.map((d:any, i:number) => (
          <button key={d.id} onClick={() => setDay(i)}
            style={{ padding:'8px 18px', borderRadius:24, fontSize:11, fontWeight: i===day ? 800 : 500, border: i===day ? 'none' : '1.5px solid #DDD', background: i===day ? d.color : '#fff', color: i===day ? '#fff' : '#9CA3AF', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, boxShadow: i===day ? `0 4px 16px ${d.color}44` : '0 1px 3px rgba(0,0,0,.04)' }}>
            يوم {d.day_num} · {d.city}
          </button>
        ))}
      </div>

      {/* View Toggle */}
      <div style={{ display:'flex', gap:4, margin:'12px 16px 0', background:'#ECEAE5', borderRadius:12, padding:3 }}>
        {[{id:'list' as const, label:'≡ قائمة'}, {id:'map' as const, label:'🗺️ خريطة'}].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            style={{ flex:1, padding:'9px 10px', borderRadius:10, border:'none', background: view===v.id ? '#fff' : 'transparent', color: view===v.id ? '#1C4532' : '#9CA3AF', fontSize:11, fontWeight: view===v.id ? 800 : 500, cursor:'pointer', boxShadow: view===v.id ? '0 2px 8px rgba(0,0,0,.08)' : 'none' }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'flex', margin:'12px 16px 0', background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,.04)' }}>
        {[{ val:`يوم ${day+1}`, lbl:'الجدول' }, { val:currentDay?.city, lbl:'المدينة' }, { val:stops.length, lbl:'محطة' }].map((s,i) => (
          <div key={i} style={{ flex:1, textAlign:'center', padding:'12px 0', borderLeft: i<2 ? '1px solid #F3F0EB' : 'none' }}>
            <div style={{ fontSize:17, fontWeight:900, color:'#1C4532' }}>{s.val}</div>
            <div style={{ fontSize:9, color:'#9CA3AF', marginTop:3 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* MAP */}
      {view === 'map' && (
        <div style={{ margin:'12px 16px 0', borderRadius:20, overflow:'hidden', border:'1px solid #E2DDD4', height:380, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
          <div ref={mapRef} style={{ width:'100%', height:'100%' }} />
        </div>
      )}

      {/* LIST */}
      {view === 'list' && (
        <div style={{ padding:'16px 16px 0', maxWidth:680, margin:'0 auto' }}>
          <div style={{ marginBottom:16, paddingBottom:14, borderBottom:'1px solid #E8E4DC' }}>
            <div style={{ fontSize:26, fontWeight:600, color:'#1C4532' }}>يوم {currentDay?.day_num}</div>
            <div style={{ fontSize:16, color:'#6B7280', fontStyle:'italic', marginTop:2 }}>{currentDay?.title}</div>
          </div>

          {stops.map((stop:any, idx:number) => {
            const cat = CATEGORIES[stop.category] || CATEGORIES.o
            return (
              <div key={stop.id}>
                {/* Transit */}
                {idx > 0 && stop.transit_mode && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'6px 0', margin:'2px 0 2px 40px' }}>
                    <div style={{ height:1, flex:1, maxWidth:40, background:`linear-gradient(90deg,transparent,${currentDay.color}30)` }} />
                    <div style={{ display:'flex', alignItems:'center', gap:7, background:'#fff', border:'1px solid #EDE9E3', borderRadius:24, padding:'5px 14px', fontSize:10, color:'#6B7280', boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
                      <span>{TRANSIT[stop.transit_mode]?.icon || '🚶'}</span>
                      <span style={{ fontWeight:700, color:'#374151' }}>{TRANSIT[stop.transit_mode]?.label}</span>
                      <span style={{ color:'#D1D5DB' }}>·</span>
                      <span>{stop.transit_duration}</span>
                      <span style={{ color:'#D1D5DB' }}>·</span>
                      <span style={{ color:'#9CA3AF', fontSize:9 }}>{stop.transit_distance}</span>
                    </div>
                    <div style={{ height:1, flex:1, maxWidth:40, background:`linear-gradient(270deg,transparent,${currentDay.color}30)` }} />
                  </div>
                )}

                {/* Place Card */}
                <div style={{ display:'flex', gap:14, marginBottom:6 }}>
                  {/* Timeline marker */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:36, flexShrink:0, paddingTop:4 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${currentDay.color},${currentDay.color}CC)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:900, boxShadow:`0 4px 14px ${currentDay.color}44`, flexShrink:0, zIndex:1 }}>
                      {idx + 1}
                    </div>
                    {idx < stops.length - 1 && <div style={{ width:2, flex:1, background:`linear-gradient(180deg,${currentDay.color}30,${currentDay.color}08)`, marginTop:4, minHeight:16 }} />}
                  </div>

                  {/* Card */}
                  <div onClick={() => setDetail(stop)} style={{ flex:1, minWidth:0, background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,.06)', cursor:'pointer', transition:'transform .3s', marginBottom:8 }}>
                    {/* Image */}
                    <div style={{ position:'relative', height:180, background:'#111' }}>
                      <img src={stop.image_url || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=80'} alt={stop.place_name}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                        onError={(e:any) => { e.target.src = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=80' }}
                      />
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,transparent 35%,rgba(0,0,0,.75) 88%)' }} />
                      {/* Category pill */}
                      <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,.5)', backdropFilter:'blur(12px)', padding:'5px 10px', borderRadius:24 }}>
                        <span style={{ fontSize:11 }}>{cat.icon}</span>
                        <span style={{ fontSize:9, color:'#fff', fontWeight:600 }}>{cat.label}</span>
                      </div>
                      {/* Time */}
                      {stop.time_slot && (
                        <div style={{ position:'absolute', top:12, left:12, display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,.5)', backdropFilter:'blur(12px)', padding:'5px 9px', borderRadius:24 }}>
                          <span style={{ fontSize:10, color:'#fff' }}>🕐 {stop.time_slot}</span>
                        </div>
                      )}
                      {/* Name */}
                      <div style={{ position:'absolute', bottom:14, left:16, right:16, zIndex:3 }}>
                        <div style={{ fontSize:18, fontWeight:600, color:'#fff', textShadow:'0 2px 12px rgba(0,0,0,.5)' }}>{stop.place_name}</div>
                      </div>
                    </div>
                    {/* Tip teaser */}
                    {stop.note && (
                      <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <Sparkles size={12} color="#C9A84C" />
                          <span style={{ fontSize:10, color:'#92400E', fontWeight:600 }}>نصيحة Wanderloom</span>
                        </div>
                        <span style={{ fontSize:9, color:'#9CA3AF' }}>تفاصيل ←</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Sheet */}
      {detail && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)' }}
          onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', position:'relative' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'#DDD', margin:'12px auto 0' }} />
            <button onClick={() => setDetail(null)} style={{ position:'absolute', top:16, left:16, width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,.06)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>
              <X size={14} />
            </button>
            {/* Hero */}
            <div style={{ margin:'16px 16px 0', borderRadius:20, overflow:'hidden', height:220, position:'relative' }}>
              <img src={detail.image_url || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=80'} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.7) 100%)' }} />
              <div style={{ position:'absolute', bottom:16, right:16, left:16, fontSize:22, fontWeight:600, color:'#fff', textShadow:'0 2px 12px rgba(0,0,0,.4)' }}>{detail.place_name}</div>
            </div>
            <div style={{ padding:'18px 20px 24px' }}>
              {/* Pills */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:10, background: CATEGORIES[detail.category]?.bg, color: CATEGORIES[detail.category]?.color, fontSize:11, fontWeight:700 }}>
                  {CATEGORIES[detail.category]?.icon} {CATEGORIES[detail.category]?.label}
                </span>
                {detail.time_slot && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:10, background:'#F0FDF4', color:'#166534', fontSize:11, fontWeight:600, border:'1px solid #BBF7D0' }}>
                    🕐 {detail.time_slot}
                  </span>
                )}
              </div>
              {/* Tip */}
              {detail.note && (
                <div style={{ background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border:'1px solid #FDE68A', borderRadius:14, padding:'14px 16px', marginBottom:18, display:'flex', gap:10 }}>
                  <Sparkles size={16} color="#C9A84C" style={{ flexShrink:0, marginTop:2 }} />
                  <div>
                    <div style={{ fontSize:9, fontWeight:800, color:'#92400E', letterSpacing:1.5, marginBottom:4 }}>WANDERLOOM TIP</div>
                    <div style={{ fontSize:12, color:'#78350F', lineHeight:1.75 }}>{detail.note}</div>
                  </div>
                </div>
              )}
              {/* Google Maps */}
              <button onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(detail.place_name)}`, '_blank')}
                style={{ width:'100%', padding:15, border:'none', borderRadius:14, background:'#1C4532', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <MapPin size={15} /> فتح في Google Maps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:80 }}>
        <button onClick={() => {
          const msg = `✏️ طلب تعديل — Wanderloom\n\n👤 ${clientName}\n🔑 ${journey.passcode}\n📅 يوم ${day+1} · ${currentDay?.city}\n\n💬 `
          window.open(`https://wa.me/966544948640?text=${encodeURIComponent(msg)}`, '_blank')
        }}
          style={{ padding:'14px 28px', background:'linear-gradient(135deg,#1C4532,#2D6A4F)', color:'#fff', border:'2px solid rgba(201,168,76,.3)', borderRadius:16, fontSize:12, fontWeight:800, cursor:'pointer', boxShadow:'0 8px 32px rgba(28,69,50,.4)', display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' }}>
          <MessageCircle size={14} color="#C9A84C" /> طلب تعديل على المسار
        </button>
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', padding:'32px 16px 24px', background:'#07100D', marginTop:28 }}>
        <div style={{ fontSize:17, color:'#C9A84C', letterSpacing:6, opacity:.6 }}>Wanderloom</div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,.15)', marginTop:5, letterSpacing:4 }}>رحلة مهندسة بعناية · {clientName}</div>
      </div>
    </div>
  )
}
