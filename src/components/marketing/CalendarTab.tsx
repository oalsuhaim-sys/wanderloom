'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = [
  { key: 'sun', label: 'الأحد', date: '6' },
  { key: 'mon', label: 'الإثنين', date: '7' },
  { key: 'tue', label: 'الثلاثاء', date: '8' },
  { key: 'wed', label: 'الأربعاء', date: '9' },
  { key: 'thu', label: 'الخميس', date: '10' },
  { key: 'fri', label: 'الجمعة', date: '11' },
  { key: 'sat', label: 'السبت', date: '12' },
] as const;

const HOURS = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'] as const;

type CalendarEvent = {
  day: (typeof DAYS)[number]['key'];
  hour: (typeof HOURS)[number];
  title: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'X';
};

const EVENTS: CalendarEvent[] = [
  { day: 'sun', hour: '11:00', title: 'ريلز سيول', platform: 'Instagram' },
  { day: 'mon', hour: '15:00', title: 'ستوري المجموعة', platform: 'TikTok' },
  { day: 'tue', hour: '09:00', title: 'كاروسيل الوجهات', platform: 'Instagram' },
  { day: 'wed', hour: '17:00', title: 'شورت يوتيوب', platform: 'YouTube' },
  { day: 'thu', hour: '13:00', title: 'تغريدة العرض', platform: 'X' },
  { day: 'fri', hour: '19:00', title: 'ريلز نهاية الأسبوع', platform: 'Instagram' },
];

function platformTone(platform: CalendarEvent['platform']): string {
  switch (platform) {
    case 'Instagram':
      return 'bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:ring-pink-800/40';
    case 'TikTok':
      return 'bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:ring-cyan-800/40';
    case 'YouTube':
      return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/40';
    case 'X':
      return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-[#1A2421] dark:text-slate-300 dark:ring-[#2D3F3A]';
  }
}

export default function CalendarTab() {
  return (
    <section dir="rtl" className="space-y-4" aria-labelledby="calendar-tab-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 dark:text-[#D4AF37]/80">
            Weekly Schedule
          </p>
          <h2
            id="calendar-tab-heading"
            className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl"
          >
            التقويم
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            أسبوع النشر — خانات زمنية مع وسوم المنصات.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]"
            aria-label="الأسبوع السابق"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
            6 – 12 سبتمبر
          </span>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:hover:bg-[#1A2421]"
            aria-label="الأسبوع التالي"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 dark:border-[#2D3F3A]">
            <div className="bg-slate-50 p-3 dark:bg-[#1A2421]" />
            {DAYS.map((day) => (
              <div
                key={day.key}
                className="border-r border-slate-100 bg-slate-50 p-3 text-center last:border-r-0 dark:border-[#2D3F3A] dark:bg-[#1A2421]"
              >
                <p className="text-xs font-medium text-slate-400">{day.label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-800 dark:text-white">{day.date}</p>
              </div>
            ))}
          </div>

          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 last:border-b-0 dark:border-[#2D3F3A]"
            >
              <div className="flex items-start justify-center bg-slate-50/70 py-3 text-xs font-semibold text-slate-400 dark:bg-[#1A2421]/60">
                <span dir="ltr">{hour}</span>
              </div>
              {DAYS.map((day) => {
                const event = EVENTS.find((e) => e.day === day.key && e.hour === hour);
                return (
                  <div
                    key={`${day.key}-${hour}`}
                    className="min-h-[4.5rem] border-r border-slate-100 p-1.5 last:border-r-0 dark:border-[#2D3F3A]"
                  >
                    {event ? (
                      <div className="flex h-full flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">
                          {event.title}
                        </p>
                        <span
                          className={`inline-flex w-fit rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${platformTone(event.platform)}`}
                        >
                          {event.platform}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
