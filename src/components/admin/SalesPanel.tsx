import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp } from "lucide-react";

type OrderItem = { id: string; name: string; price: number; qty: number };
type Order = {
  id: string;
  order_no: number;
  branch_name: string | null;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
};

const RIYADH = "Asia/Riyadh";
const dateTimeFmt = new Intl.DateTimeFormat("ar-SA", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: RIYADH,
});
const monthFmt = new Intl.DateTimeFormat("ar-SA", { month: "long", year: "numeric", timeZone: RIYADH });

const money = (n: number) => `${n.toFixed(2)} ر.س`;

const SalesPanel = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<"month" | "year">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id,order_no,branch_name,items,total,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      console.error(error.message);
      return;
    }
    setOrders(
      (data ?? []).map((o) => ({
        ...o,
        total: Number(o.total),
        items: (o.items as unknown as OrderItem[]) ?? [],
      }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inRange = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (mode === "year") return d.getFullYear() === cursor.getFullYear();
      return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
    },
    [mode, cursor]
  );

  const filtered = useMemo(() => orders.filter((o) => inRange(o.created_at)), [orders, inRange]);

  const totals = useMemo(() => {
    const count = filtered.length;
    const revenue = filtered.reduce((s, o) => s + o.total, 0);
    return { count, revenue, avg: count ? revenue / count : 0 };
  }, [filtered]);

  const byBranch = useMemo(() => {
    const m = new Map<string, { count: number; revenue: number }>();
    filtered.forEach((o) => {
      const k = o.branch_name || "بدون فرع";
      const cur = m.get(k) || { count: 0, revenue: 0 };
      m.set(k, { count: cur.count + 1, revenue: cur.revenue + o.total });
    });
    return Array.from(m.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [filtered]);

  const perPeriod = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => {
      const d = new Date(o.created_at);
      const key = mode === "year" ? String(d.getMonth() + 1) : String(d.getDate());
      m.set(key, (m.get(key) || 0) + o.total);
    });
    const len = mode === "year" ? 12 : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: len }, (_, i) => ({ label: String(i + 1), value: m.get(String(i + 1)) || 0 }));
  }, [filtered, mode, cursor]);

  const maxVal = Math.max(1, ...perPeriod.map((p) => p.value));

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (mode === "year") d.setFullYear(d.getFullYear() + dir);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h2 className="font-display text-xl flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> تقارير المبيعات
        </h2>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4" /> تحديث
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="inline-flex rounded-xl border p-1">
          <button
            className={`px-4 py-1.5 rounded-lg text-sm ${mode === "month" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("month")}
          >
            شهري
          </button>
          <button
            className={`px-4 py-1.5 rounded-lg text-sm ${mode === "year" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("year")}
          >
            سنوي
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>السابق</Button>
          <span className="text-sm font-bold min-w-28 text-center">
            {mode === "year" ? cursor.getFullYear() : monthFmt.format(cursor)}
          </span>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>التالي</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="عدد الطلبات" value={String(totals.count)} />
        <Stat label="إجمالي المبيعات" value={money(totals.revenue)} />
        <Stat label="متوسط الطلب" value={money(totals.avg)} />
      </div>

      <section className="rounded-2xl border bg-card p-4 mb-8">
        <h3 className="font-bold mb-4">{mode === "year" ? "المبيعات حسب الشهر" : "المبيعات حسب اليوم"}</h3>
        <div className="flex items-end gap-1 h-40">
          {perPeriod.map((p) => (
            <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/80"
                style={{ height: `${(p.value / maxVal) * 100}%`, minHeight: p.value > 0 ? 3 : 0 }}
                title={money(p.value)}
              />
              <span className="text-[9px] text-muted-foreground">{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 mb-8">
        <h3 className="font-bold mb-4">حسب الفروع</h3>
        {byBranch.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد مبيعات في هذه الفترة</p>
        ) : (
          <div className="space-y-3">
            {byBranch.map(([name, v]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{name}</span>
                  <span className="text-muted-foreground">
                    {v.count} طلب · {money(v.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(v.revenue / (totals.revenue || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h3 className="font-bold mb-4">تفاصيل الطلبات ({filtered.length})</h3>
        <div className="divide-y">
          {filtered.map((o) => (
            <div key={o.id} className="py-3">
              <button
                className="w-full flex items-center justify-between gap-3 text-right"
                onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)}
              >
                <span className="font-bold">#{o.order_no}</span>
                <span className="text-xs text-muted-foreground flex-1">
                  {dateTimeFmt.format(new Date(o.created_at))} · {o.branch_name || "بدون فرع"}
                </span>
                <span className="font-bold whitespace-nowrap">{money(o.total)}</span>
              </button>
              {openOrder === o.id && (
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 pr-2">
                  {o.items.map((i, idx) => (
                    <li key={`${o.id}-${idx}`}>
                      • {i.name} ×{i.qty} — {money(i.price * i.qty)}
                    </li>
                  ))}
                  <li className="text-xs">الحالة: {o.status === "answered" ? "تم الرد" : "بانتظار الرد"}</li>
                </ul>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">لا توجد طلبات في هذه الفترة</p>
          )}
        </div>
      </section>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border bg-card p-4">
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

export default SalesPanel;
