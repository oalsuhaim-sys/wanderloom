"use client";

export default function SystemFeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans" dir="rtl">
      {/* رأس الصفحة */}
      <div className="bg-[#001f3f] text-white rounded-3xl p-10 mb-10 shadow-xl border-b-4 border-[#d4af37]">
        <h1 className="text-4xl font-extrabold mb-4 text-[#d4af37]">دليل القوة التشغيلية والميزات 🌍</h1>
        <p className="text-lg opacity-90 text-gray-200">
          مرجعك الشامل لتفهم قوة النظام الذي بين يديك، وكيف تستخدمه لإغلاق المبيعات وتقديم خدمة VIP لا تُنسى.
        </p>
      </div>

      {/* القسم الأول: ما الذي يميزنا عن السوق؟ */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-[#d4af37]">⚡</span> كيف نختلف عن المكاتب التقليدية؟ (ميزات الأفراد)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <FeatureCard
            title="الأمان الرقمي (درع الحماية)"
            desc="نحمي الرحلة برمز PIN، ونمنع النسخ أو التصوير. العميل يشعر بالخصوصية المطلقة وأن بياناته محمية."
            icon="🔏"
          />
          <FeatureCard
            title="البوردينق الذكي"
            desc="كل تفاصيل الطيران (بوابة، مطار، تيرمنل، ووقت الخروج من المنزل) في رابط واحد جاهز للطباعة."
            icon="🎫"
          />
          <FeatureCard
            title="المزامنة مع التقويم"
            desc="نحن نزرع الرحلة داخل تقويم العميل (Apple/Google). نرافقه كالمساعد الشخصي خطوة بخطوة."
            icon="📅"
          />
          <FeatureCard
            title="الذكاء الجغرافي"
            desc="خريطة تفاعلية للوجهة، طقس لحظي، وكلمات محلية (تحدث كالمحليين) تكسر حاجز الغربة."
            icon="🗺️"
          />
          <FeatureCard
            title="🧬 ملف الـ DNA السياحي (Hyper-Personalization)"
            desc="حفظ تفضيلات العميل الدقيقة (مقعد النافذة، الحساسيات، نوع القهوة، ستايل الفنادق). عند حجزه القادم، فاجئه بأنك تتذكر أدق تفاصيله دون أن يسألك!"
            icon="🧬"
            emphasized
          />
        </div>
      </div>

      {/* القسم الثاني: مميزات القروبات (التسويق الذكي) */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-[#d4af37]">👥</span> أسلحة المبيعات في القروبات السياحية
        </h2>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border-r-4 border-indigo-500 pr-4">
              <h3 className="text-xl font-bold text-indigo-900 mb-2">نظام "شارك واربح" (Viral Referral)</h3>
              <p className="text-gray-600 mb-2"><strong>كيف تبيع بها؟</strong> قل للعميل: "انسخ الرابط وشاركه مع أصدقائك، وإذا حجزوا ستحصل على ترقية أو خصم حصري".</p>
              <p className="text-sm text-gray-500">النتيجة: العميل يصبح مسوقاً مجانياً لنا.</p>
            </div>
            <div className="border-r-4 border-orange-500 pr-4">
              <h3 className="text-xl font-bold text-orange-900 mb-2">ذكاء المقاعد (قائمة الانتظار VIP)</h3>
              <p className="text-gray-600 mb-2"><strong>كيف تبيع بها؟</strong> النظام ينبه العميل إذا بقيت مقاعد قليلة (يخلق حالة FOMO)، وإذا امتلأت الرحلة يسجله في قائمة الانتظار تلقائياً.</p>
              <p className="text-sm text-gray-500">النتيجة: لا نخسر أي عميل محتمل حتى والرحلة ممتلئة.</p>
            </div>
          </div>
        </div>
      </div>

      {/* القسم الثالث: أدوات الموظف */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-[#d4af37]">🛠️</span> أدواتك كـ "مهندس تجربة سفر"
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#f8fafc] p-6 rounded-2xl border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">📡 الرادار الحي</h3>
            <p className="text-gray-600 text-sm">شاشة تريك من يسافر اليوم. بادر بإرسال رسالة "رحلة سعيدة" للعميل يوم إقلاعه لتبهره باهتمامك.</p>
          </div>
          <div className="bg-[#f8fafc] p-6 rounded-2xl border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">💰 الميزانية الثلاثية</h3>
            <p className="text-gray-600 text-sm">الرابط يقترح 3 مستويات (اقتصادي، قياسي، فاخر). دع العميل يختار ما يناسب جيبه دون إحراج.</p>
          </div>
          <div className="bg-[#f8fafc] p-6 rounded-2xl border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">⚡ التعديل اللحظي</h3>
            <p className="text-gray-600 text-sm">تغير الفندق؟ لا مشكلة. عدله في النظام وسينعكس فوراً في رابط العميل بدون الحاجة لإرسال ملفات جديدة.</p>
          </div>
        </div>
      </div>

    </div>
  );
}

// مكون لتصميم البطاقات
function FeatureCard({ title, desc, icon, emphasized }: { title: string; desc: string; icon: string; emphasized?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className={`text-sm leading-relaxed ${emphasized ? "text-gray-900 font-medium" : "text-gray-500"}`}>{desc}</p>
    </div>
  );
}
