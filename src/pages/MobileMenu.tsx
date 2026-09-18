import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Minus, Phone, Plus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import dripLogo from "@/assets/julith/julith-logo.jpg.asset.json";
import { buildOrderText, CALL_NUMBER, openWhatsApp, saveOrder } from "@/lib/order";

type Category = { id: string; name: string; sort_order: number };
type Product = { id: string; category_id: string; name: string; price: number; is_available: boolean; sort_order: number };
type Branch = { id: string; name: string; sort_order: number };

const MobileMenu = () => {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }, { data: b }] = await Promise.all([
        supabase.from("categories").select("id,name,sort_order").order("sort_order"),
        supabase.from("products").select("id,category_id,name,price,is_available,sort_order").eq("is_available", true).order("sort_order"),
        supabase.from("branches").select("id,name,sort_order").order("sort_order"),
      ]);
      setCats(c ?? []);
      setProds(p ?? []);
      setBranches(b ?? []);
      if (b && b.length === 1) setBranchId(b[0].id);
    })();
  }, []);

  const change = (id: string, delta: number) =>
    setQty((q) => {
      const next = Math.max(0, (q[id] ?? 0) + delta);
      const copy = { ...q };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const items = prods
    .filter((p) => qty[p.id])
    .map((p) => ({ id: p.id, name: p.name, price: Number(p.price), qty: qty[p.id] }));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const branch = branches.find((b) => b.id === branchId) ?? null;

  const send = async () => {
    if (!items.length || sending) return;
    setSending(true);
    const orderNo = await saveOrder({
      items,
      total,
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
    });
    if (!orderNo) toast.error("تعذّر حفظ الطلب، سيُرسل عبر واتساب فقط");
    openWhatsApp(buildOrderText(items, total, { orderNo, branchName: branch?.name }));
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-36">
      <Helmet>
        <title>منيو جوليث للجوال — اطلب عبر واتساب</title>
        <meta name="description" content="منيو جوليث Julith لشاشة الجوال: تصفّح الأصناف واطلب مباشرة عبر واتساب أو اتصل بالفرع." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="canonical" href="/m" />
      </Helmet>

      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <img src={dripLogo.url} alt="جوليث Julith" className="w-9 h-9 rounded-full object-cover" />
          <div className="flex-1">
            <p className="font-latin font-bold text-lg leading-none text-olive">Julith</p>
            <p className="text-xs text-muted-foreground mt-0.5">منيو الجوال</p>
          </div>
          <a href={`tel:${CALL_NUMBER}`} className="w-9 h-9 rounded-full bg-olive/10 text-olive flex items-center justify-center" aria-label="اتصال">
            <Phone className="w-4 h-4" />
          </a>
        </div>
      </header>

      {branches.length > 0 && (
        <div className="px-4 pt-4">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            aria-label="اختر الفرع"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          >
            <option value="">— اختر الفرع —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <main className="px-4 py-4 space-y-7">
        {cats.map((cat) => {
          const list = prods.filter((p) => p.category_id === cat.id);
          if (!list.length) return null;
          return (
            <section key={cat.id}>
              <h2 className="text-lg font-bold mb-3">{cat.name}</h2>
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{Number(p.price).toFixed(2)} ر.س</p>
                    </div>
                    {qty[p.id] ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => change(p.id, -1)} aria-label="نقص" className="w-8 h-8 rounded-full border bg-background flex items-center justify-center">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{qty[p.id]}</span>
                        <button type="button" onClick={() => change(p.id, 1)} aria-label="زيادة" className="w-8 h-8 rounded-full bg-olive text-white flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => change(p.id, 1)} className="btn-soft px-3 py-1.5 text-xs" aria-label={`أضف ${p.name}`}>
                        <Plus className="w-3.5 h-3.5" /> أضف
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {count > 0 && (
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{count} صنف</span>
            <span className="font-bold text-olive">{total.toFixed(2)} ر.س</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={send}
            disabled={!count || sending}
            className="flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-[hsl(36_50%_97%)] disabled:opacity-50"
            style={{ background: "#25D366" }}
          >
            <MessageCircle className="w-5 h-5" />
            {sending ? "جارٍ الإرسال…" : "اطلب عبر واتساب"}
          </button>
          <a
            href={`tel:${CALL_NUMBER}`}
            className="flex items-center justify-center gap-2 rounded-xl py-3 font-bold bg-olive text-white"
          >
            <Phone className="w-5 h-5" />
            اتصال
          </a>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
