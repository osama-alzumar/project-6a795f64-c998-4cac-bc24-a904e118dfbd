import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Visit = {
  id: string;
  session_id: string | null;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  language: string | null;
  screen_size: string | null;
  visited_at: string;
};

const DevStats = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "إحصائيات الموقع";
    const load = async () => {
      const { data } = await supabase
        .from("site_visits")
        .select("*")
        .order("visited_at", { ascending: false })
        .limit(1000);
      setVisits((data as Visit[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const total = visits.length;
  const uniqueSessions = new Set(visits.map((v) => v.session_id).filter(Boolean)).size;
  const now = Date.now();
  const within = (ms: number) => visits.filter((v) => now - new Date(v.visited_at).getTime() <= ms).length;
  const last24h = within(24 * 60 * 60 * 1000);
  const last7d = within(7 * 24 * 60 * 60 * 1000);
  const last30d = within(30 * 24 * 60 * 60 * 1000);
  const today = visits.filter((v) => {
    const d = new Date(v.visited_at);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;

  // Per day (last 14 days)
  const dayMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  visits.forEach((v) => {
    const k = new Date(v.visited_at).toISOString().slice(0, 10);
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + 1);
  });
  const days = Array.from(dayMap.entries());
  const maxDay = Math.max(1, ...days.map(([, n]) => n));

  // Browser detection
  const detectBrowser = (ua: string | null) => {
    if (!ua) return "غير معروف";
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/SamsungBrowser/.test(ua)) return "Samsung";
    return "أخرى";
  };
  const detectOS = (ua: string | null) => {
    if (!ua) return "غير معروف";
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
    if (/Mac OS X/.test(ua)) return "macOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux/.test(ua)) return "Linux";
    return "أخرى";
  };

  const count = <T,>(arr: T[]) => {
    const m = new Map<string, number>();
    arr.forEach((x) => {
      const k = String(x);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };

  const browsers = count(visits.map((v) => detectBrowser(v.user_agent)));
  const oses = count(visits.map((v) => detectOS(v.user_agent)));
  const referrers = count(
    visits.map((v) => {
      if (!v.referrer) return "مباشر";
      try {
        return new URL(v.referrer).hostname;
      } catch {
        return "غير معروف";
      }
    })
  );
  const langs = count(visits.map((v) => v.language || "غير معروف"));

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <p className="text-gold tracking-[0.4em] text-xs">DEVELOPER · OSAMA</p>
          <h1 className="font-display text-3xl md:text-4xl text-cream mt-2">لوحة الإحصائيات</h1>
          <p className="text-cream/60 text-sm mt-1">صفحة خاصة بالمطور — أسامة الشريف</p>
        </header>

        {loading ? (
          <div className="text-center py-20 text-cream/60">جارٍ التحميل...</div>
        ) : (
          <>
            {/* Big stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="إجمالي الزيارات" value={total} highlight />
              <StatCard label="زوّار فريدون" value={uniqueSessions} />
              <StatCard label="اليوم" value={today} />
              <StatCard label="آخر 24 ساعة" value={last24h} />
              <StatCard label="آخر 7 أيام" value={last7d} />
              <StatCard label="آخر 30 يوم" value={last30d} />
              <StatCard
                label="متوسط زيارات/جلسة"
                value={uniqueSessions ? (total / uniqueSessions).toFixed(1) : "0"}
              />
              <StatCard
                label="آخر زيارة"
                value={visits[0] ? new Date(visits[0].visited_at).toLocaleTimeString("ar") : "—"}
                small
              />
            </div>

            {/* Daily chart */}
            <Section title="الزيارات اليومية (آخر 14 يوم)">
              <div className="flex items-end gap-2 h-48 px-2">
                {days.map(([d, n]) => (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[10px] text-cream/70 group-hover:text-gold">{n}</div>
                    <div
                      className="w-full rounded-t bg-gradient-gold transition-all"
                      style={{ height: `${(n / maxDay) * 100}%`, minHeight: n > 0 ? 4 : 0 }}
                    />
                    <div className="text-[9px] text-cream/50 -rotate-45 origin-top-right whitespace-nowrap mt-2">
                      {d.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <BreakdownCard title="المتصفحات" items={browsers} />
              <BreakdownCard title="أنظمة التشغيل" items={oses} />
              <BreakdownCard title="مصدر الزيارة" items={referrers} />
              <BreakdownCard title="اللغة" items={langs} />
            </div>

            {/* Recent visits */}
            <Section title="آخر 30 زيارة">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-cream/60 text-right">
                    <tr className="border-b border-cream/10">
                      <th className="py-2 px-2">الوقت</th>
                      <th className="py-2 px-2">المتصفح</th>
                      <th className="py-2 px-2">النظام</th>
                      <th className="py-2 px-2">المصدر</th>
                      <th className="py-2 px-2">المسار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 30).map((v) => (
                      <tr key={v.id} className="border-b border-cream/5 text-cream/80">
                        <td className="py-2 px-2 whitespace-nowrap">
                          {new Date(v.visited_at).toLocaleString("ar")}
                        </td>
                        <td className="py-2 px-2">{detectBrowser(v.user_agent)}</td>
                        <td className="py-2 px-2">{detectOS(v.user_agent)}</td>
                        <td className="py-2 px-2">
                          {v.referrer ? (() => { try { return new URL(v.referrer).hostname; } catch { return "—"; } })() : "مباشر"}
                        </td>
                        <td className="py-2 px-2">{v.path || "/"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, highlight, small }: { label: string; value: number | string; highlight?: boolean; small?: boolean }) => (
  <div
    className={`rounded-xl border p-5 ${
      highlight ? "border-gold/60 bg-gradient-to-br from-gold/15 to-transparent" : "border-cream/10 bg-card/40"
    }`}
  >
    <div className="text-cream/60 text-xs mb-2">{label}</div>
    <div className={`font-display text-gold ${small ? "text-xl" : "text-3xl md:text-4xl"}`}>{value}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-8 rounded-xl border border-cream/10 bg-card/40 p-5">
    <h2 className="font-display text-xl text-cream mb-4">{title}</h2>
    {children}
  </div>
);

const BreakdownCard = ({ title, items }: { title: string; items: [string, number][] }) => {
  const total = items.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div className="rounded-xl border border-cream/10 bg-card/40 p-5">
      <h3 className="font-display text-lg text-cream mb-4">{title}</h3>
      <div className="space-y-2">
        {items.slice(0, 6).map(([k, n]) => {
          const pct = (n / total) * 100;
          return (
            <div key={k}>
              <div className="flex justify-between text-xs text-cream/70 mb-1">
                <span>{k}</span>
                <span>{n} ({pct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 rounded-full bg-cream/10 overflow-hidden">
                <div className="h-full bg-gradient-gold" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-cream/40 text-sm">لا توجد بيانات بعد</div>}
      </div>
    </div>
  );
};

export default DevStats;