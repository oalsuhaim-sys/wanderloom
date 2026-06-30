"use client";
import { useState, useEffect } from "react";

import { supabase } from "@/lib/supabase/universal";

export default function PublicGroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase.from("tour_groups").select("*").order("start_date", { ascending: true });
      setGroups(data || []);
      setLoading(false);
    };
    void fetchGroups();
  }, []);

  if (loading) return <div className="min-h-screen flex justify-center items-center font-bold text-gray-500">جاري تحميل الرحلات الفاخرة... 🌍</div>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#111111]" dir="rtl">
      <div className="border-b border-[#1e3f20]/10 bg-gradient-to-b from-[#f4efe6] to-[#FDFBF7] py-20 px-4 text-center">
        <h1 className="mb-4 text-4xl font-extrabold text-[#111111] md:text-5xl">رحلاتنا الجماعية الفاخرة</h1>
        <p className="text-lg text-gray-600">اكتشف العالم مع نخبة من المسافرين وقيادة خبراء السياحة</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {groups.length === 0 ? (
          <div className="text-center text-gray-500 text-xl py-20">لا توجد رحلات مجدولة حالياً. اشترك في القائمة البريدية ليصلك جديدنا!</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {groups.map((group: any) => {
              const isFull = group.available_seats === 0;
              const almostFull = !isFull && group.available_seats <= 3;
              const shareText = encodeURIComponent(`رحلة خرافية إلى ${group.destination} مع قروب سياحي فخم! شوف التفاصيل: ${typeof window !== 'undefined' ? window.location.href : ''}`);

              return (
                <div key={group.id} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col hover:-translate-y-1 transition-all duration-300">
                  <div className="p-8">
                    {/* رأس البطاقة والثيمات */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(group.theme || []).map((t: string) => (
                        <span key={t} className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">{t}</span>
                      ))}
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{group.title}</h2>
                        <p className="text-indigo-600 font-bold">📍 {group.destination} | ⏱️ {group.days_count} أيام</p>
                      </div>
                      <div className="text-left bg-green-50 p-3 rounded-2xl border border-green-100">
                        <span className="text-2xl font-black text-green-700">{group.package_price}</span>
                        <span className="text-xs text-green-600 block">ريال / للشخص</span>
                      </div>
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-6">{group.description}</p>

                    {/* المدن والتواريخ */}
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-2xl">
                      <div><span className="block font-bold text-gray-900 mb-1">المدن:</span> {(group.cities || []).join(" - ")}</div>
                      <div>
                        <span className="block font-bold text-gray-900 mb-1">التاريخ:</span> 
                        {new Date(group.start_date).toLocaleDateString('ar-SA')} ➔ {new Date(group.end_date).toLocaleDateString('ar-SA')}
                      </div>
                    </div>

                    {/* تشمل / لا تشمل */}
                    <div className="flex gap-6 mb-8 text-sm">
                      <div className="flex-1">
                        <span className="font-bold text-green-600 block mb-2">✅ تشمل:</span>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          {(group.included || []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-red-500 block mb-2">❌ لا تشمل:</span>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          {(group.not_included || []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    </div>

                    {/* التسويق الفيروسي */}
                    <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-purple-50 text-purple-700 py-3 rounded-xl font-bold hover:bg-purple-100 transition mb-6">
                      🎁 شارك الرحلة واحصل على خصم أو ترقية!
                    </a>
                  </div>

                  {/* تذييل البطاقة (حالة المقاعد وزر الحجز) */}
                  <div className={`p-6 mt-auto border-t flex flex-col md:flex-row justify-between items-center gap-4 ${isFull ? 'bg-orange-50' : 'bg-white'}`}>
                    <div>
                      {isFull ? (
                        <div className="text-orange-600 font-bold flex items-center gap-2"><span>⏳</span> اكتمل العدد (متاح قائمة انتظار)</div>
                      ) : (
                        <div className="text-gray-700 font-bold">
                          المقاعد المتاحة: <span className={almostFull ? 'text-red-500 text-xl' : 'text-green-600 text-xl'}>{group.available_seats}</span> / {group.total_seats}
                          {almostFull && <div className="text-xs text-red-500 animate-pulse mt-1">🔥 سارع بالحجز، مقاعد محدودة!</div>}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => alert(isFull ? "تم تسجيلك في قائمة الانتظار VIP. سنتواصل معك فور توفر مقعد!" : "جاري تحويلك لصفحة الدفع وإتمام الحجز...")}
                      className={`px-8 py-4 rounded-xl font-bold shadow-lg transition w-full md:w-auto ${
                        isFull 
                        ? 'bg-orange-500 hover:bg-orange-600 text-white border border-orange-600' 
                        : 'bg-black text-white hover:bg-gray-800'
                      }`}
                    >
                      {isFull ? 'الانضمام لقائمة الانتظار' : 'حجز مقعد الآن'}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}