'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Search, Hotel, MapPin, Clock, ArrowLeft, ArrowRight, Copy, MessageCircle, Check } from 'lucide-react'

const COLORS = ['#2563EB','#7C3AED','#059669','#E11D48','#D97706','#0891B2']
const TRANSIT_OPTS = [{v:'',l:'— بدون —'},{v:'walk',l:'🚶 مشي'},{v:'car',l:'🚗 سيارة'},{v:'subway',l:'🚇 مترو'},{v:'bus',l:'🚌 باص'}]
const AR_EN: Record<string,string> = {'أ':'A','ب':'B','ت':'T','ث':'TH','ج':'J','ح':'H','خ':'KH','د':'D','ذ':'Z','ر':'R','ز':'Z','س':'S','ش':'SH','ص':'S','ض':'D','ط':'T','ع':'A','غ':'G','ف':'F','ق':'Q','ك':'K','ل':'L','م':'M','ن':'N','ه':'H','و':'W','ي':'Y','ة':'A','ى':'A','إ':'A','آ':'A','ء':'A'}
const DEST_MAP: Record<string,string> = {'اليابان':'JP','كوريا':'KR','كوريا الجنوبية':'KR','ألمانيا':'DE','فرنسا':'FR','إيطاليا':'IT','إسبانيا':'ES','بريطانيا':'UK','المملكة المتحدة':'UK','هولندا':'NL','التشيك':'CZ','المجر':'HU','سويسرا':'CH','بولندا':'PL','السويد':'SE','روسيا':'RU','كندا':'CA','جنوب أفريقيا':'ZA','الصين':'CN','النمسا':'AT','بلجيكا':'BE','اسكتلندا':'UK','أمريكا':'US','الولايات المتحدة':'US','البرتغال':'PT'}

type Stop = { place_name:string; category:string; time_slot:string; note:string; image_url:string; transit_mode:string; transit_duration:string; transit_distance:string; place_id?:string }
type Day = { city:string; title:string; color:string; hotel_name:string; hotel_checkin:string; hotel_checkout:string; stops:Stop[] }

const emptyStop = ():Stop => ({place_name:'',category:'o',time_slot:'',note:'',image_url:'',transit_mode:'',transit_duration:'',transit_distance:''})

export default function NewItineraryPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [clients, setClients] = useState<any[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [dates, setDates] = useState('')
  const [days, setDays] = useState<Day[]>([{city:'',title:'اليوم 1',color:COLORS[0],hotel_name:'',hotel_checkin:'',hotel_checkout:'',stops:[emptyStop()]}])
  const [saving, setSaving] = useState(false)
  const [successCode, setSuccessCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Place search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchingDay, setSearchingDay] = useState(-1)
  const [searchingStop, setSearchingStop] = useState(-1)

  useEffect(() => {
    if(!supabase)return
    supabase.from('clients').select('id,name,phone_wa,client_preferences(interests)').order('name').then(({data})=>{if(data)setClients(data)})
    supabase.from('places').select('city').limit(5000).then(({data})=>{
      if(data){const u=[...new Set(data.map((d:any)=>d.city).filter(Boolean))].sort();setCities(u as string[])}
    })
  }, [])

  // Search places by city
  const searchPlaces = async (query:string, city:string) => {
    if(!supabase)return
    let q = supabase.from('places').select('id,name,city,category,image_url')
    if(city) q = q.eq('city', city)
    if(query.trim()) q = q.ilike('name', `%${query}%`)
    const {data} = await q.limit(15).order('name')
    setSearchResults(data||[])
  }

  const selectPlace = (place:any, dayIdx:number, stopIdx:number) => {
    const newDays = [...days]
    newDays[dayIdx].stops[stopIdx] = {
      ...newDays[dayIdx].stops[stopIdx],
      place_name: place.name,
      category: place.category||'o',
      image_url: place.image_url||'',
      place_id: place.id,
    }
    setDays(newDays)
    setSearchResults([])
    setSearchingDay(-1)
    setSearchingStop(-1)
    setSearchQuery('')
  }

  const generatePasscode = () => {
    if(!selectedClient) return 'WL-XXXX-XX'
    const name = (selectedClient.name||'').split(' ')[0]||''
    const en = name.split('').map((c:string)=>AR_EN[c]||c.toUpperCase()).join('').replace(/[^A-Z]/g,'').slice(0,4)||'WL'
    const firstCity = days[0]?.city||''
    // Find country from city
    let destCode = 'XX'
    for(const [country,code] of Object.entries(DEST_MAP)){
      if(firstCity.includes(country)||title.includes(country)) { destCode=code; break }
    }
    return `WL-${en}-${destCode}`
  }

  const addDay = () => {
    setDays([...days, {city:'',title:`اليوم ${days.length+1}`,color:COLORS[days.length%COLORS.length],hotel_name:'',hotel_checkin:'',hotel_checkout:'',stops:[emptyStop()]}])
  }

  const removeDay = (idx:number) => {
    if(days.length<=1)return
    setDays(days.filter((_,i)=>i!==idx))
  }

  const addStop = (dayIdx:number) => {
    const newDays = [...days]
    newDays[dayIdx].stops.push(emptyStop())
    setDays(newDays)
  }

  const removeStop = (dayIdx:number, stopIdx:number) => {
    const newDays = [...days]
    if(newDays[dayIdx].stops.length<=1)return
    newDays[dayIdx].stops = newDays[dayIdx].stops.filter((_,i)=>i!==stopIdx)
    setDays(newDays)
  }

  const updateDay = (idx:number, field:string, val:string) => {
    const newDays = [...days]
    ;(newDays[idx] as any)[field] = val
    setDays(newDays)
  }

  const updateStop = (dayIdx:number, stopIdx:number, field:string, val:string) => {
    const newDays = [...days]
    ;(newDays[dayIdx].stops[stopIdx] as any)[field] = val
    setDays(newDays)
  }

  const moveStop = (dayIdx:number, stopIdx:number, dir:number) => {
    const newDays = [...days]
    const stops = newDays[dayIdx].stops
    const newIdx = stopIdx + dir
    if(newIdx<0||newIdx>=stops.length)return
    ;[stops[stopIdx],stops[newIdx]] = [stops[newIdx],stops[stopIdx]]
    setDays(newDays)
  }

  const save = async () => {
    if(!supabase||!selectedClient)return
    setSaving(true)
    const passcode = generatePasscode()

    // 1. Create itinerary
    const {data:itin,error:e1} = await supabase.from('itineraries').insert({
      client_id: selectedClient.id,
      title, dates, passcode, status:'draft'
    }).select().single()

    if(!itin||e1){setSaving(false);alert('خطأ في الحفظ: '+(e1?.message||''));return}

    // 2. Create days
    for(let di=0; di<days.length; di++){
      const d = days[di]
      const {data:dayData} = await supabase.from('itinerary_days').insert({
        itinerary_id: itin.id,
        day_num: di+1,
        title: d.title,
        city: d.city,
        color: d.color,
        sort_order: di+1,
        hotel_name: d.hotel_name,
        hotel_checkin: d.hotel_checkin,
        hotel_checkout: d.hotel_checkout,
      }).select().single()

      if(!dayData)continue

      // 3. Create stops
      for(let si=0; si<d.stops.length; si++){
        const s = d.stops[si]
        if(!s.place_name)continue
        await supabase.from('itinerary_stops').insert({
          day_id: dayData.id,
          place_name: s.place_name,
          category: s.category,
          time_slot: s.time_slot,
          note: s.note,
          image_url: s.image_url,
          sort_order: si+1,
          transit_mode: s.transit_mode,
          transit_duration: s.transit_duration,
          transit_distance: s.transit_distance,
        })
      }
    }

    setSuccessCode(passcode)
    setSaving(false)
  }

  const CAT_LABELS: Record<string,string> = {l:'🏛️ معلم',r:'🍽️ مطعم',c:'☕ كافيه',s:'🛍️ تسوق',d:'🎭 تجربة',h:'🏨 فندق',f:'🍜 طعام',o:'🧭 أخرى'}

  // ═══ SUCCESS SCREEN ═══
  if(successCode) {
    const waMsg = `مرحباً ${selectedClient?.name}! ✨\n\nمسارك الفاخر جاهز 🌍\n\n🔑 الرمز: ${successCode}\n\nافتح البوابة:\nhttps://wanderloom-travel.vercel.app/portal\n\n— Wanderloom ✦`
    const waNum = selectedClient?.phone_wa?.replace(/^0/,'966')||''
    return (
      <div dir="rtl" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#07100D',fontFamily:'sans-serif'}}>
        <div style={{textAlign:'center',maxWidth:440,width:'90%'}}>
          <div style={{fontSize:48,marginBottom:16}}>🎉</div>
          <div style={{fontSize:24,fontWeight:800,color:'#C9A84C',marginBottom:8}}>تم إنشاء المسار!</div>
          <div style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:6,padding:'16px 24px',background:'rgba(201,168,76,.1)',borderRadius:16,border:'2px solid rgba(201,168,76,.3)',marginBottom:20}}>{successCode}</div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <button onClick={()=>{navigator.clipboard.writeText(successCode);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{flex:1,padding:14,background:copied?'#059669':'#1C4532',color:'#fff',border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              {copied?<><Check size={14}/>تم النسخ</>:<><Copy size={14}/>نسخ الكود</>}
            </button>
            {waNum&&<button onClick={()=>window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`,'_blank')} style={{flex:1,padding:14,background:'#25D366',color:'#fff',border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <MessageCircle size={14}/>واتساب
            </button>}
          </div>
          <button onClick={()=>router.push('/crm/itineraries')} style={{width:'100%',padding:12,background:'rgba(255,255,255,.1)',color:'#9CA3AF',border:'none',borderRadius:12,fontSize:12,cursor:'pointer'}}>العودة للمسارات</button>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{padding:'20px 16px',fontFamily:'sans-serif',maxWidth:800,margin:'0 auto',minHeight:'100vh',background:'#F6F4F0'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:800,color:'#1C4532'}}>إنشاء مسار جديد</div>
        <button onClick={()=>router.push('/crm/itineraries')} style={{background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:12}}>← رجوع</button>
      </div>

      {/* Progress */}
      <div style={{display:'flex',gap:4,marginBottom:24}}>
        {[1,2,3].map(s=><div key={s} style={{flex:1,height:4,borderRadius:2,background:step>=s?'#C9A84C':'#E5E0D6'}}/>)}
      </div>

      {/* ═══ STEP 1: Client + Info ═══ */}
      {step===1&&(
        <div>
          <div style={{background:'#fff',borderRadius:16,padding:20,marginBottom:12,border:'1px solid #F3F0EB'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#1C4532',marginBottom:12}}>👤 اختيار العميل</div>
            <select value={selectedClient?.id||''} onChange={e=>{const c=clients.find(c=>c.id===e.target.value);setSelectedClient(c||null)}} style={{width:'100%',padding:12,border:'1.5px solid #E5E0D6',borderRadius:12,fontSize:13,direction:'rtl'}}>
              <option value="">اختر العميل...</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone_wa?`· ${c.phone_wa}`:''}</option>)}
            </select>
            {selectedClient?.client_preferences?.[0]?.interests?.length>0&&(
              <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
                {selectedClient.client_preferences[0].interests.map((i:string,idx:number)=><span key={idx} style={{padding:'4px 10px',borderRadius:8,background:'#EDE9FE',color:'#5B21B6',fontSize:10,fontWeight:600}}>🌍 {i}</span>)}
              </div>
            )}
          </div>
          <div style={{background:'#fff',borderRadius:16,padding:20,marginBottom:12,border:'1px solid #F3F0EB'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#1C4532',marginBottom:12}}>📋 معلومات المسار</div>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان المسار — مثال: اليابان — رحلة الأضواء والصمت" style={{width:'100%',padding:12,border:'1.5px solid #E5E0D6',borderRadius:12,fontSize:13,direction:'rtl',marginBottom:10,outline:'none'}}/>
            <input value={dates} onChange={e=>setDates(e.target.value)} placeholder="التواريخ — مثال: ١٥ – ٢٥ أبريل ٢٠٢٦" style={{width:'100%',padding:12,border:'1.5px solid #E5E0D6',borderRadius:12,fontSize:13,direction:'rtl',outline:'none'}}/>
            <div style={{marginTop:10,padding:'8px 14px',background:'#F6F4F0',borderRadius:10,fontSize:12,color:'#6B7280'}}>🔑 الكود التلقائي: <strong style={{color:'#1C4532'}}>{generatePasscode()}</strong></div>
          </div>
          <button onClick={()=>setStep(2)} disabled={!selectedClient||!title} style={{width:'100%',padding:14,background:'#1C4532',color:'#fff',border:'none',borderRadius:14,fontSize:14,fontWeight:800,cursor:'pointer',opacity:(!selectedClient||!title)?.4:1}}>التالي — إضافة الأيام →</button>
        </div>
      )}

      {/* ═══ STEP 2: Days ═══ */}
      {step===2&&(
        <div>
          {days.map((d,di)=>(
            <div key={di} style={{background:'#fff',borderRadius:16,padding:16,marginBottom:12,border:`2px solid ${d.color}22`,borderRight:`4px solid ${d.color}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:15,fontWeight:800,color:d.color}}>يوم {di+1}</div>
                {days.length>1&&<button onClick={()=>removeDay(di)} style={{background:'#FEE2E2',border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer'}}><Trash2 size={12} color="#DC2626"/></button>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'#6B7280'}}>المدينة *</label>
                  <select value={d.city} onChange={e=>updateDay(di,'city',e.target.value)} style={{width:'100%',padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl'}}>
                    <option value="">اختر المدينة...</option>
                    {cities.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'#6B7280'}}>عنوان اليوم</label>
                  <input value={d.title} onChange={e=>updateDay(di,'title',e.target.value)} style={{width:'100%',padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl',outline:'none'}}/>
                </div>
              </div>

              {/* Hotel */}
              <div style={{background:'#ECFEFF',borderRadius:12,padding:12,border:'1px solid #0891B233'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#0891B2',marginBottom:8,display:'flex',alignItems:'center',gap:4}}><Hotel size={13}/>الفندق</div>
                <input value={d.hotel_name} onChange={e=>updateDay(di,'hotel_name',e.target.value)} placeholder="اسم الفندق — مثال: ريتز كارلتون" style={{width:'100%',padding:9,border:'1.5px solid #0891B233',borderRadius:8,fontSize:12,direction:'rtl',marginBottom:6,outline:'none',background:'#fff'}}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  <div>
                    <label style={{fontSize:9,color:'#6B7280'}}>وقت الدخول</label>
                    <input value={d.hotel_checkin} onChange={e=>updateDay(di,'hotel_checkin',e.target.value)} placeholder="15:00" style={{width:'100%',padding:8,border:'1.5px solid #0891B233',borderRadius:8,fontSize:12,outline:'none',background:'#fff'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:9,color:'#6B7280'}}>وقت الخروج</label>
                    <input value={d.hotel_checkout} onChange={e=>updateDay(di,'hotel_checkout',e.target.value)} placeholder="11:00" style={{width:'100%',padding:8,border:'1.5px solid #0891B233',borderRadius:8,fontSize:12,outline:'none',background:'#fff'}}/>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addDay} style={{width:'100%',padding:12,background:'#F6F4F0',border:'2px dashed #C9A84C',borderRadius:14,color:'#C9A84C',fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:12}}>+ إضافة يوم</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setStep(1)} style={{flex:1,padding:14,background:'#F3F0EB',color:'#6B7280',border:'none',borderRadius:14,fontSize:13,fontWeight:700,cursor:'pointer'}}>← السابق</button>
            <button onClick={()=>setStep(3)} disabled={!days[0]?.city} style={{flex:2,padding:14,background:'#1C4532',color:'#fff',border:'none',borderRadius:14,fontSize:14,fontWeight:800,cursor:'pointer',opacity:!days[0]?.city?.4:1}}>التالي — المحطات →</button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Stops ═══ */}
      {step===3&&(
        <div>
          {days.map((d,di)=>(
            <div key={di} style={{marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:800,color:d.color,marginBottom:10,padding:'8px 14px',background:'#fff',borderRadius:12,borderRight:`4px solid ${d.color}`}}>
                يوم {di+1} · {d.city} · {d.title}
                {d.hotel_name&&<span style={{fontSize:10,color:'#0891B2',marginRight:8}}>🏨 {d.hotel_name}</span>}
              </div>

              {d.stops.map((s,si)=>(
                <div key={si} style={{background:'#fff',borderRadius:14,padding:14,marginBottom:8,border:'1px solid #F3F0EB'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:d.color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900}}>{si+1}</div>
                      <span style={{fontSize:12,fontWeight:700,color:'#1C4532'}}>محطة {si+1}</span>
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>moveStop(di,si,-1)} disabled={si===0} style={{padding:'4px 8px',background:'#F3F0EB',border:'none',borderRadius:6,cursor:'pointer',fontSize:10}}>↑</button>
                      <button onClick={()=>moveStop(di,si,1)} disabled={si===d.stops.length-1} style={{padding:'4px 8px',background:'#F3F0EB',border:'none',borderRadius:6,cursor:'pointer',fontSize:10}}>↓</button>
                      {d.stops.length>1&&<button onClick={()=>removeStop(di,si)} style={{padding:'4px 8px',background:'#FEE2E2',border:'none',borderRadius:6,cursor:'pointer'}}><Trash2 size={10} color="#DC2626"/></button>}
                    </div>
                  </div>

                  {/* Place search */}
                  <div style={{marginBottom:8,position:'relative'}}>
                    <label style={{fontSize:10,fontWeight:700,color:'#6B7280',marginBottom:4,display:'block'}}>بحث في أماكن {d.city}</label>
                    <div style={{display:'flex',gap:6}}>
                      <div style={{flex:1,position:'relative'}}>
                        <input
                          value={searchingDay===di&&searchingStop===si?searchQuery:s.place_name}
                          onChange={e=>{
                            setSearchQuery(e.target.value)
                            setSearchingDay(di);setSearchingStop(si)
                            searchPlaces(e.target.value, d.city)
                          }}
                          onFocus={()=>{setSearchingDay(di);setSearchingStop(si);searchPlaces('',d.city)}}
                          placeholder={`ابحث في ${d.city}...`}
                          style={{width:'100%',padding:'9px 32px 9px 10px',border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl',outline:'none'}}
                        />
                        <Search size={13} style={{position:'absolute',right:10,top:10}} color="#9CA3AF"/>
                      </div>
                    </div>

                    {/* Search results dropdown */}
                    {searchingDay===di&&searchingStop===si&&searchResults.length>0&&(
                      <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',borderRadius:10,border:'1px solid #E5E0D6',boxShadow:'0 8px 24px rgba(0,0,0,.12)',zIndex:50,maxHeight:200,overflowY:'auto',marginTop:4}}>
                        {searchResults.map(p=>(
                          <div key={p.id} onClick={()=>selectPlace(p,di,si)} style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #F3F0EB',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}} onMouseEnter={e=>(e.currentTarget.style.background='#F6F4F0')} onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                            <div>
                              <div style={{fontWeight:700,color:'#1C4532'}}>{p.name}</div>
                              <div style={{fontSize:10,color:'#9CA3AF'}}>{p.city}</div>
                            </div>
                            <span style={{fontSize:9,padding:'3px 8px',borderRadius:6,background:'#F3F0EB',color:'#6B7280'}}>{CAT_LABELS[p.category]||'🧭'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual input */}
                  {!s.place_name&&(
                    <input value={s.place_name} onChange={e=>updateStop(di,si,'place_name',e.target.value)} placeholder="أو اكتب اسم المكان يدوياً..." style={{width:'100%',padding:9,border:'1.5px dashed #C9A84C55',borderRadius:10,fontSize:12,direction:'rtl',marginBottom:6,outline:'none',background:'#FFFBEB'}}/>
                  )}

                  {s.place_name&&(
                    <div style={{fontSize:13,fontWeight:700,color:'#1C4532',padding:'6px 0',marginBottom:6}}>{CAT_LABELS[s.category]||''} {s.place_name}</div>
                  )}

                  {/* Time + Transit */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
                    <div>
                      <label style={{fontSize:9,color:'#6B7280'}}>الوقت</label>
                      <input type="time" value={s.time_slot} onChange={e=>updateStop(di,si,'time_slot',e.target.value)} style={{width:'100%',padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:12,outline:'none'}}/>
                    </div>
                    <div>
                      <label style={{fontSize:9,color:'#6B7280'}}>وسيلة التنقل</label>
                      <select value={s.transit_mode} onChange={e=>updateStop(di,si,'transit_mode',e.target.value)} style={{width:'100%',padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:12}}>
                        {TRANSIT_OPTS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </div>
                  </div>
                  {s.transit_mode&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
                      <input value={s.transit_duration} onChange={e=>updateStop(di,si,'transit_duration',e.target.value)} placeholder="المدة — مثال: 15 دقيقة" style={{padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:11,direction:'rtl',outline:'none'}}/>
                      <input value={s.transit_distance} onChange={e=>updateStop(di,si,'transit_distance',e.target.value)} placeholder="المسافة — مثال: 2 كم" style={{padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:11,direction:'rtl',outline:'none'}}/>
                    </div>
                  )}
                  <textarea value={s.note} onChange={e=>updateStop(di,si,'note',e.target.value)} placeholder="ملاحظة / نصيحة Wanderloom..." rows={2} style={{width:'100%',padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:11,direction:'rtl',resize:'none',outline:'none'}}/>
                </div>
              ))}

              <button onClick={()=>addStop(di)} style={{width:'100%',padding:10,background:'#F6F4F0',border:'1.5px dashed #C9A84C',borderRadius:10,color:'#C9A84C',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ إضافة محطة</button>
            </div>
          ))}

          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setStep(2)} style={{flex:1,padding:14,background:'#F3F0EB',color:'#6B7280',border:'none',borderRadius:14,fontSize:13,fontWeight:700,cursor:'pointer'}}>← السابق</button>
            <button onClick={save} disabled={saving} style={{flex:2,padding:14,background:'linear-gradient(135deg,#8A6B2A,#C9A84C)',color:'#1C4532',border:'none',borderRadius:14,fontSize:14,fontWeight:900,cursor:'pointer',opacity:saving?.5:1}}>
              {saving?'جارٍ الحفظ...':'✅ حفظ المسار'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}