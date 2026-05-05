'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Phone, Mail, Pencil, Trash2, Save, X, Plus, Gift, MessageCircle } from 'lucide-react'

const STATUS_MAP: Record<string,{label:string,color:string,bg:string}> = {
  new:{label:'جديد',color:'#2563EB',bg:'#DBEAFE'},
  contacted:{label:'تم التواصل',color:'#7C3AED',bg:'#EDE9FE'},
  designing:{label:'تصميم المسار',color:'#D97706',bg:'#FEF3C7'},
  sent:{label:'تم الإرسال',color:'#0891B2',bg:'#ECFEFF'},
  confirmed:{label:'مؤكد',color:'#059669',bg:'#D1FAE5'},
  visa:{label:'التأشيرة',color:'#7C3AED',bg:'#EDE9FE'},
  booked:{label:'محجوز',color:'#059669',bg:'#D1FAE5'},
  completed:{label:'مكتمل',color:'#6B7280',bg:'#F3F4F6'},
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<any>(null)
  const [prefs, setPrefs] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Edit states
  const [editStatus, setEditStatus] = useState('')
  const [editingCode, setEditingCode] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [codeCount, setCodeCount] = useState(0)
  const [editingTrip, setEditingTrip] = useState<string|null>(null)
  const [editTripData, setEditTripData] = useState({destination:'',profit:0,trip_date:''})
  const [newNote, setNewNote] = useState('')
  const [newTrip, setNewTrip] = useState({destination:'',profit:'',trip_date:'',notes:''})
  const [showAddTrip, setShowAddTrip] = useState(false)

  const load = async () => {
    if(!supabase) return
    const {data:c} = await supabase.from('clients').select('*').eq('id',clientId).single()
    if(c){setClient(c);setEditStatus(c.status);setNewCode(c.ref_code||'')}

    const {data:p} = await supabase.from('client_preferences').select('*').eq('client_id',clientId).single()
    if(p)setPrefs(p)

    const {data:t} = await supabase.from('client_trips').select('*').eq('client_id',clientId).order('created_at',{ascending:false})
    if(t)setTrips(t)

    const {data:n} = await supabase.from('client_notes').select('*').eq('client_id',clientId).order('created_at',{ascending:false})
    if(n)setNotes(n)

    // Count referrals
    if(c?.ref_code){
      const {count} = await supabase.from('clients').select('*',{count:'exact',head:true}).eq('used_code',c.ref_code)
      setCodeCount(count||0)
    }

    setLoading(false)
  }

  useEffect(()=>{load()},[clientId])

  // ═══ ACTIONS ═══
  const saveStatus = async () => {
    if(!supabase)return
    await supabase.from('clients').update({status:editStatus}).eq('id',clientId)
    setClient({...client,status:editStatus})
  }

  const saveCode = async () => {
    if(!supabase)return
    await supabase.from('clients').update({ref_code:newCode}).eq('id',clientId)
    setClient({...client,ref_code:newCode});setEditingCode(false)
  }

  const deleteCode = async () => {
    if(!supabase||!window.confirm('حذف كود الإحالة؟'))return
    await supabase.from('clients').update({ref_code:null}).eq('id',clientId)
    setClient({...client,ref_code:null});setNewCode('')
  }

  const generateCode = async () => {
    if(!supabase||!client)return
    const name = client.name.slice(0,4).replace(/\s/g,'')
    const num = Math.floor(Math.random()*900+100)
    const code = `WL-${name}-${num}`
    await supabase.from('clients').update({ref_code:code}).eq('id',clientId)
    setClient({...client,ref_code:code});setNewCode(code)
  }

  const deleteTrip = async (tripId:string) => {
    if(!supabase||!window.confirm('هل أنت متأكد من حذف هذه الرحلة؟'))return
    await supabase.from('client_trips').delete().eq('id',tripId)
    setTrips(trips.filter(t=>t.id!==tripId))
  }

  const startEditTrip = (trip:any) => {
    setEditingTrip(trip.id)
    setEditTripData({destination:trip.destination,profit:trip.profit,trip_date:trip.trip_date||''})
  }

  const saveEditTrip = async () => {
    if(!supabase||!editingTrip)return
    await supabase.from('client_trips').update({
      destination:editTripData.destination,
      profit:Number(editTripData.profit),
      trip_date:editTripData.trip_date||null
    }).eq('id',editingTrip)
    setTrips(trips.map(t=>t.id===editingTrip?{...t,...editTripData,profit:Number(editTripData.profit)}:t))
    setEditingTrip(null)
  }

  const addTrip = async () => {
    if(!supabase||!newTrip.destination)return
    const {data} = await supabase.from('client_trips').insert({
      client_id:clientId,
      destination:newTrip.destination,
      profit:Number(newTrip.profit)||0,
      trip_date:newTrip.trip_date||null,
      notes:newTrip.notes
    }).select().single()
    if(data){setTrips([data,...trips]);setShowAddTrip(false);setNewTrip({destination:'',profit:'',trip_date:'',notes:''})}
  }

  const addNote = async () => {
    if(!supabase||!newNote.trim())return
    const {data} = await supabase.from('client_notes').insert({client_id:clientId,note_text:newNote.trim(),author:'omar'}).select().single()
    if(data){setNotes([data,...notes]);setNewNote('')}
  }

  if(loading) return <div dir="rtl" style={{padding:40,textAlign:'center',color:'#9CA3AF'}}>جارٍ التحميل...</div>
  if(!client) return <div dir="rtl" style={{padding:40,textAlign:'center',color:'#DC2626'}}>العميل غير موجود</div>

  const st = STATUS_MAP[client.status]||STATUS_MAP.new
  const totalRevenue = trips.reduce((s,t)=>s+(t.profit||0),0)

  return (
    <div dir="rtl" style={{padding:'20px 16px',fontFamily:'sans-serif',maxWidth:900,margin:'0 auto'}}>

      {/* Back button */}
      <button onClick={()=>router.push('/crm/clients')} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:12,marginBottom:16}}>
        <ArrowRight size={14}/>رجوع للعملاء
      </button>

      {/* Header */}
      <div style={{background:'#fff',borderRadius:16,padding:'20px 24px',marginBottom:12,boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
        <div style={{fontSize:24,fontWeight:900,color:'#1C4532',marginBottom:8}}>{client.name}</div>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'#6B7280'}}>
          {client.phone_wa&&<span style={{display:'flex',alignItems:'center',gap:4}}><Phone size={12}/>{client.phone_wa}</span>}
          {client.email&&<span style={{display:'flex',alignItems:'center',gap:4}}><Mail size={12}/>{client.email}</span>}
          {client.job_type&&<span>💼 {client.job_type}</span>}
          {client.travel_type&&<span>🧳 {client.travel_type}</span>}
        </div>
      </div>

      {/* Status */}
      <div style={{background:'#fff',borderRadius:16,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1C4532',marginBottom:8}}>✏️ الحالة</div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={editStatus} onChange={e=>setEditStatus(e.target.value)} style={{flex:1,padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl'}}>
            {Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={saveStatus} style={{padding:'10px 20px',background:'#1C4532',color:'#fff',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>حفظ</button>
        </div>
      </div>

      {/* Referral Code */}
      <div style={{background:'#fff',borderRadius:16,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1C4532',marginBottom:10}}>🎁 كود الإحالة</div>
        {client.ref_code ? (
          <div>
            {editingCode ? (
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                <input value={newCode} onChange={e=>setNewCode(e.target.value)} style={{flex:1,padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:14,fontWeight:700,textAlign:'center'}}/>
                <button onClick={saveCode} style={{padding:'10px 14px',background:'#1C4532',color:'#fff',border:'none',borderRadius:10,cursor:'pointer'}}><Save size={14}/></button>
                <button onClick={()=>setEditingCode(false)} style={{padding:'10px 14px',background:'#F3F0EB',border:'none',borderRadius:10,cursor:'pointer'}}><X size={14}/></button>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <div style={{fontSize:20,fontWeight:900,color:'#1C4532',padding:'8px 20px',background:'#F6F4F0',borderRadius:12,letterSpacing:2}}>{client.ref_code}</div>
                <button onClick={()=>setEditingCode(true)} style={{padding:'8px 12px',background:'#FEF3C7',border:'none',borderRadius:8,cursor:'pointer'}}><Pencil size={12} color="#D97706"/></button>
                <button onClick={deleteCode} style={{padding:'8px 12px',background:'#FEE2E2',border:'none',borderRadius:8,cursor:'pointer'}}><Trash2 size={12} color="#DC2626"/></button>
              </div>
            )}
            <div style={{fontSize:11,color:'#6B7280'}}>عدد من استخدم هذا الكود: <strong style={{color:'#1C4532'}}>{codeCount}</strong></div>
            {codeCount>=3&&<div style={{marginTop:6,padding:'4px 12px',background:'#FEF3C7',borderRadius:8,fontSize:11,fontWeight:700,color:'#D97706',display:'inline-block'}}>⭐ عميل مميز</div>}
          </div>
        ) : (
          <button onClick={generateCode} style={{padding:'10px 20px',background:'linear-gradient(135deg,#8A6B2A,#C9A84C)',color:'#1C4532',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>🎁 توليد كود إحالة</button>
        )}
      </div>

      {/* Interests */}
      {prefs?.interests?.length>0&&(
        <div style={{background:'#fff',borderRadius:16,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1C4532',marginBottom:8}}>🌍 الوجهات المرغوبة</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {prefs.interests.map((i:string,idx:number)=><span key={idx} style={{padding:'5px 12px',borderRadius:8,background:'#EDE9FE',color:'#5B21B6',fontSize:11,fontWeight:700}}>🌍 {i}</span>)}
          </div>
        </div>
      )}

      {/* Trips */}
      <div style={{background:'#fff',borderRadius:16,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:'#1C4532'}}>✈️ سجل الرحلات</div>
            <div style={{fontSize:11,color:'#059669',fontWeight:700}}>الإجمالي: {totalRevenue.toLocaleString()} ر.س</div>
          </div>
          <button onClick={()=>setShowAddTrip(!showAddTrip)} style={{display:'flex',alignItems:'center',gap:4,padding:'8px 14px',background:'#D1FAE5',border:'none',borderRadius:10,fontSize:11,fontWeight:700,color:'#065F46',cursor:'pointer'}}><Plus size={12}/>إضافة رحلة</button>
        </div>

        {/* Add trip form */}
        {showAddTrip&&(
          <div style={{background:'#F6F4F0',borderRadius:12,padding:14,marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <input value={newTrip.destination} onChange={e=>setNewTrip({...newTrip,destination:e.target.value})} placeholder="الوجهة *" style={{padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl'}}/>
              <input type="number" value={newTrip.profit} onChange={e=>setNewTrip({...newTrip,profit:e.target.value})} placeholder="الربح" style={{padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <input type="date" value={newTrip.trip_date} onChange={e=>setNewTrip({...newTrip,trip_date:e.target.value})} style={{padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12}}/>
              <input value={newTrip.notes} onChange={e=>setNewTrip({...newTrip,notes:e.target.value})} placeholder="ملاحظات" style={{padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl'}}/>
            </div>
            <button onClick={addTrip} style={{width:'100%',padding:12,background:'#1C4532',color:'#fff',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>+ إضافة الرحلة</button>
          </div>
        )}

        {/* Trips list */}
        {trips.length===0?<div style={{textAlign:'center',padding:20,color:'#9CA3AF',fontSize:12}}>لا توجد رحلات</div>:
          trips.map(t=>(
            <div key={t.id} style={{padding:'12px 14px',background:'#FAFAF8',borderRadius:12,marginBottom:6,border:'1px solid #F3F0EB'}}>
              {editingTrip===t.id?(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <input value={editTripData.destination} onChange={e=>setEditTripData({...editTripData,destination:e.target.value})} style={{padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:12,direction:'rtl'}}/>
                    <input type="number" value={editTripData.profit} onChange={e=>setEditTripData({...editTripData,profit:Number(e.target.value)})} style={{padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:12}}/>
                  </div>
                  <input type="date" value={editTripData.trip_date} onChange={e=>setEditTripData({...editTripData,trip_date:e.target.value})} style={{width:'100%',padding:8,border:'1.5px solid #E5E0D6',borderRadius:8,fontSize:12,marginBottom:8}}/>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={saveEditTrip} style={{flex:1,padding:8,background:'#1C4532',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>💾 حفظ</button>
                    <button onClick={()=>setEditingTrip(null)} style={{padding:'8px 14px',background:'#F3F0EB',border:'none',borderRadius:8,fontSize:11,cursor:'pointer'}}>إلغاء</button>
                  </div>
                </div>
              ):(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'#1C4532'}}>✈️ {t.destination}</div>
                    {t.trip_date&&<div style={{fontSize:10,color:'#9CA3AF',marginTop:2}}>📅 {t.trip_date}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:14,fontWeight:800,color:'#059669'}}>{(t.profit||0).toLocaleString()} ر.س</span>
                    <button onClick={()=>startEditTrip(t)} style={{width:30,height:30,borderRadius:8,border:'none',background:'#FEF3C7',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Pencil size={12} color="#D97706"/></button>
                    <button onClick={()=>deleteTrip(t.id)} style={{width:30,height:30,borderRadius:8,border:'none',background:'#FEE2E2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={12} color="#DC2626"/></button>
                  </div>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Notes */}
      <div style={{background:'#fff',borderRadius:16,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1C4532',marginBottom:10}}>💬 الملاحظات</div>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="اكتب ملاحظة..." rows={2} style={{flex:1,padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:12,direction:'rtl',resize:'none',outline:'none'}}/>
          <button onClick={addNote} disabled={!newNote.trim()} style={{padding:'10px 16px',background:'#1C4532',color:'#fff',border:'none',borderRadius:10,fontSize:11,fontWeight:700,cursor:'pointer',opacity:newNote.trim()?1:.4}}>إرسال</button>
        </div>
        {notes.map(n=>(
          <div key={n.id} style={{padding:'10px 14px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,marginBottom:6,fontSize:12,color:'#78350F',lineHeight:1.7}}>
            <div>{n.note_text}</div>
            <div style={{fontSize:9,color:'#D97706',marginTop:4}}>✍️ {n.author} · {new Date(n.created_at).toLocaleDateString('ar-SA')}</div>
          </div>
        ))}
      </div>

      {/* WhatsApp */}
      {client.phone_wa&&(
        <button onClick={()=>window.open(`https://wa.me/966${client.phone_wa.replace(/^0/,'')}`,'_blank')} style={{width:'100%',padding:14,background:'#25D366',color:'#fff',border:'none',borderRadius:14,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <MessageCircle size={16}/>فتح واتساب
        </button>
      )}
    </div>
  )
}