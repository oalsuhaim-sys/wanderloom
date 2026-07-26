'use client'
import { useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PLACE_CATEGORY_OPTIONS,
  PLACES_BANK_CATEGORIES,
} from '@/lib/places-bank'
import PlacesCsvUploader from './_components/PlacesCsvUploader'

const categoryOptions = [
  ...PLACE_CATEGORY_OPTIONS,
  // Keep legacy codes selectable so employees can reclassify old imports
  { id: 's', label: PLACES_BANK_CATEGORIES.s },
  { id: 'h', label: PLACES_BANK_CATEGORIES.h },
]

export default function VaultPage() {
  const [places, setPlaces] = useState<any[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const [newPlace, setNewPlace] = useState({name:'',country:'',city:'',category:'o',sub_tag:''})
  const [opNotice, setOpNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const loadCountries = async () => {
    if (!supabase) return
    const allCountries: string[] = []
    let offset = 0
    while (true) {
      const { data } = await supabase.from('places').select('country').range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((d: any) => { if (d.country && !allCountries.includes(d.country)) allCountries.push(d.country) })
      if (data.length < 1000) break
      offset += 1000
    }
    setCountries(allCountries.sort())
  }

  const loadCities = async (country: string) => {
    if (!supabase || !country) { setCities([]); return }
    const allCities: string[] = []
    let offset = 0
    while (true) {
      const { data } = await supabase.from('places').select('city').eq('country', country).range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((d: any) => { if (d.city && !allCities.includes(d.city)) allCities.push(d.city) })
      if (data.length < 1000) break
      offset += 1000
    }
    setCities(allCities.sort())
  }

  const loadPlaces = async () => {
    if (!supabase) return
    setLoading(true)
    let q = supabase.from('places').select('*', { count: 'exact' })
    if (search) q = q.ilike('name', '%' + search + '%')
    if (filterCountry) q = q.eq('country', filterCountry)
    if (filterCity) q = q.eq('city', filterCity)
    if (filterCat) q = q.eq('category', filterCat)
    const { data, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).order('name')
    if (data) setPlaces(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }

  useEffect(() => { loadCountries() }, [])
  useEffect(() => { loadCities(filterCountry) }, [filterCountry])
  useEffect(() => { setPage(0) }, [search, filterCountry, filterCity, filterCat])
  useEffect(() => { loadPlaces() }, [search, filterCountry, filterCity, filterCat, page])

  const handleCategoryChange = async (placeId: string, newCategory: string) => {
    if (!supabase || !placeId || !newCategory) return
    const previous = places.find((p) => String(p.id) === String(placeId))?.category

    setPlaces((prev) =>
      prev.map((p) =>
        String(p.id) === String(placeId) ? { ...p, category: newCategory } : p,
      ),
    )
    setUpdatingCategoryId(String(placeId))

    try {
      const { error } = await supabase
        .from('places')
        .update({ category: newCategory })
        .eq('id', placeId)

      if (error) throw error
      toast.success('تم تصحيح الفئة بنجاح')
    } catch (error) {
      console.error('Update failed:', error)
      setPlaces((prev) =>
        prev.map((p) =>
          String(p.id) === String(placeId) ? { ...p, category: previous } : p,
        ),
      )
      toast.error('فشل تحديث الفئة. يرجى المحاولة مرة أخرى.')
    } finally {
      setUpdatingCategoryId(null)
    }
  }

  const saveEdit = async () => {
    if (!supabase || !editing) return
    setOpNotice(null)
    const { error } = await supabase.from('places').update({ name: editing.name, country: editing.country, city: editing.city, category: editing.category, sub_tag: editing.sub_tag }).eq('id', editing.id)
    if (error) {
      setOpNotice({ type: 'err', text: error.message || 'تعذر حفظ التعديلات.' })
      return
    }
    setEditing(null)
    setOpNotice({ type: 'ok', text: 'تم حفظ التعديلات.' })
    toast.success('تم حفظ التعديلات.')
    loadPlaces()
  }

  const addNewPlace = async () => {
    if (!supabase || !newPlace.name) return
    setOpNotice(null)
    const { error } = await supabase.from('places').insert(newPlace)
    if (error) {
      setOpNotice({ type: 'err', text: error.message || 'تعذر إضافة المكان.' })
      return
    }
    setAdding(false)
    setNewPlace({name:'',country:'',city:'',category:'o',sub_tag:''})
    setOpNotice({ type: 'ok', text: 'تمت إضافة المكان.' })
    loadPlaces()
    loadCountries()
  }

  const deletePlace = async (id: string) => {
    if (!supabase || !window.confirm('حذف هذا المكان؟')) return
    setOpNotice(null)
    const { error } = await supabase.from('places').delete().eq('id', id)
    if (error) {
      setOpNotice({ type: 'err', text: error.message || 'تعذر حذف المكان.' })
      return
    }
    setOpNotice({ type: 'ok', text: 'تم الحذف.' })
    loadPlaces()
  }

  const openMaps = (p: any) => {
    window.open('https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + p.city + ' ' + p.country), '_blank')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const inputStyle = {width:'100%',padding:10,border:'1.5px solid #E5E0D6',borderRadius:10,fontSize:13,direction:'rtl' as const,outline:'none'}
  const btnStyle = (bg: string,color: string) => ({padding:'8px 14px',background:bg,color,border:'none',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700 as const})
  const smallBtn = (bg: string) => ({width:30,height:30,borderRadius:8,border:'none',background:bg,cursor:'pointer',display:'flex' as const,alignItems:'center' as const,justifyContent:'center' as const,fontSize:14})
  const categorySelectStyle = {
    fontSize: 11,
    fontWeight: 700 as const,
    padding: '4px 8px',
    borderRadius: 8,
    border: '1.5px solid #E5E0D6',
    background: '#F9FAFB',
    color: '#374151',
    cursor: 'pointer' as const,
    maxWidth: 180,
    direction: 'rtl' as const,
  }

  return (
    <div dir="rtl" style={{padding:'20px 16px',fontFamily:'sans-serif',maxWidth:1200,margin:'0 auto'}}>
      <Toaster position="top-center" />
      {opNotice ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 800,
            background: opNotice.type === 'ok' ? '#ecfdf5' : '#fef2f2',
            color: opNotice.type === 'ok' ? '#065f46' : '#991b1b',
            border: opNotice.type === 'ok' ? '1px solid #a7f3d0' : '1px solid #fecaca',
          }}
        >
          {opNotice.text}
        </div>
      ) : null}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:'#1C4532'}}>بنك الأماكن</div>
          <div style={{fontSize:11,color:'#9CA3AF'}}>{total} مكان · {countries.length} دولة · صحّح الفئة من القائمة مباشرة</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <PlacesCsvUploader
            onImported={() => {
              loadPlaces()
              loadCountries()
            }}
          />
          <button onClick={() => setAdding(true)} style={{...btnStyle('#C9A84C','#1C4532'),padding:'10px 20px',fontSize:12}}>+ إضافة مكان</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:16,background:'#fff',padding:14,borderRadius:14,border:'1px solid #E8E4DC'}}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم..." style={inputStyle}/>
        <select value={filterCountry} onChange={e => {setFilterCountry(e.target.value);setFilterCity('')}} style={inputStyle}>
          <option value="">كل الدول ({countries.length})</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={inputStyle}>
          <option value="">كل المدن ({cities.length})</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={inputStyle}>
          <option value="">كل التصنيفات</option>
          {categoryOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading ? <div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>جارٍ التحميل...</div> : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {places.map(p => (
              <div key={p.id} style={{background:'#fff',borderRadius:16,padding:'14px 16px',boxShadow:'0 1px 6px rgba(0,0,0,.04)',border:'1px solid #F3F0EB'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div style={{fontSize:15,fontWeight:800,color:'#1C4532',flex:1}}>{p.name}</div>
                  <div style={{display:'flex',gap:4}}>
                    <button onClick={() => openMaps(p)} style={smallBtn('#DBEAFE')} title="خريطة">📍</button>
                    <button onClick={() => setEditing({...p})} style={smallBtn('#FEF3C7')} title="تعديل">✏️</button>
                    <button onClick={() => deletePlace(p.id)} style={smallBtn('#FEE2E2')} title="حذف">🗑️</button>
                  </div>
                </div>
                {p.sub_tag && <div style={{fontSize:10,color:'#9CA3AF',marginBottom:8}}>{p.sub_tag}</div>}
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:9,padding:'3px 8px',borderRadius:8,background:'#DBEAFE',color:'#1E40AF',fontWeight:600}}>🌍 {p.country}</span>
                  <span style={{fontSize:9,padding:'3px 8px',borderRadius:8,background:'#EDE9FE',color:'#5B21B6',fontWeight:600}}>📍 {p.city}</span>
                  <select
                    value={p.category || 'o'}
                    disabled={updatingCategoryId === String(p.id)}
                    onChange={(e) => void handleCategoryChange(String(p.id), e.target.value)}
                    style={{
                      ...categorySelectStyle,
                      opacity: updatingCategoryId === String(p.id) ? 0.6 : 1,
                    }}
                    title="تصحيح فئة المكان في قاعدة البيانات"
                    aria-label={`تصنيف ${p.name}`}
                  >
                    {!categoryOptions.some((opt) => opt.id === p.category) && p.category ? (
                      <option value={p.category}>
                        غير معروف ({p.category})
                      </option>
                    ) : null}
                    {categoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:12,marginTop:20}}>
            <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0} style={btnStyle(page===0?'#F3F0EB':'#fff','#6B7280')}>→ السابق</button>
            <span style={{fontSize:12,color:'#6B7280'}}>{page+1} / {totalPages||1}</span>
            <button onClick={() => setPage(p => Math.min((totalPages||1)-1,p+1))} disabled={page>=(totalPages||1)-1} style={btnStyle(page>=(totalPages||1)-1?'#F3F0EB':'#fff','#6B7280')}>التالي ←</button>
          </div>
        </>
      )}

      {editing && (
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)'}} onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:24,width:'90%',maxWidth:440}}>
            <div style={{fontSize:18,fontWeight:800,color:'#1C4532',marginBottom:16}}>تعديل المكان</div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>الاسم</label><input value={editing.name||''} onChange={e => setEditing({...editing,name:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>الدولة</label><input value={editing.country||''} onChange={e => setEditing({...editing,country:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>المدينة</label><input value={editing.city||''} onChange={e => setEditing({...editing,city:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>الوصف</label><input value={editing.sub_tag||''} onChange={e => setEditing({...editing,sub_tag:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>التصنيف</label><select value={editing.category} onChange={e => setEditing({...editing,category:e.target.value})} style={inputStyle}>{categoryOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></div>
            <button onClick={saveEdit} style={{width:'100%',padding:14,background:'#1C4532',color:'#fff',border:'none',borderRadius:12,fontSize:13,fontWeight:800,cursor:'pointer'}}>💾 حفظ التعديلات</button>
          </div>
        </div>
      )}

      {adding && (
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)'}} onClick={() => setAdding(false)}>
          <div onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:24,width:'90%',maxWidth:440}}>
            <div style={{fontSize:18,fontWeight:800,color:'#1C4532',marginBottom:16}}>إضافة مكان جديد</div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>الاسم *</label><input value={newPlace.name} onChange={e => setNewPlace({...newPlace,name:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>الدولة *</label><input value={newPlace.country} onChange={e => setNewPlace({...newPlace,country:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>المدينة *</label><input value={newPlace.city} onChange={e => setNewPlace({...newPlace,city:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>الوصف</label><input value={newPlace.sub_tag} onChange={e => setNewPlace({...newPlace,sub_tag:e.target.value})} style={inputStyle}/></div>
            <div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>التصنيف</label><select value={newPlace.category} onChange={e => setNewPlace({...newPlace,category:e.target.value})} style={inputStyle}>{categoryOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></div>
            <button onClick={addNewPlace} style={{width:'100%',padding:14,background:'#1C4532',color:'#fff',border:'none',borderRadius:12,fontSize:13,fontWeight:800,cursor:'pointer'}}>✅ إضافة المكان</button>
          </div>
        </div>
      )}
    </div>
  )
}
