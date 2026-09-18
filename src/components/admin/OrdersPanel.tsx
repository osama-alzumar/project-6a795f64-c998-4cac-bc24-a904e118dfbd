import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, RefreshCw, Clock, MapPin } from "lucide-react";

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

const timeFmt = new Intl.DateTimeFormat("ar-SA", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Riyadh",
});

const OrdersPanel = () => {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("orders")
      .select("id,order_no,branch_name,items,total,status,created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
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
    const channel = supabase
      .channel("orders-live-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const poll = setInterval(() => load(), 30000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("تعذّر تحديث الحالة");
    else {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      toast.success(status === "answered" ? "تم وضع علامة: تم الرد" : "أُعيد الطلب لقائمة الانتظار");
    }
  };

  const pending = orders.filter((o) => o.status !== "answered");
  const done = orders.filter((o) => o.status === "answered");

  const Card = ({ o }: { o: Order }) => (
    <article className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">طلب #{o.order_no}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {timeFmt.format(new Date(o.created_at))}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {o.branch_name || "بدون فرع"}
            </span>
          </p>
        </div>
        <span className="font-bold text-olive whitespace-nowrap">{o.total.toFixed(2)} ر.س</span>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1">
        {o.items.map((i, idx) => (
          <li key={`${o.id}-${idx}`}>• {i.name} ×{i.qty}</li>
        ))}
      </ul>
      {o.status === "answered" ? (
        <Button variant="outline" size="sm" onClick={() => setStatus(o.id, "new")}>
          <RefreshCw className="w-4 h-4" /> إرجاع للانتظار
        </Button>
      ) : (
        <Button size="sm" onClick={() => setStatus(o.id, "answered")}>
          <Check className="w-4 h-4" /> تم الرد على العميل
        </Button>
      )}
    </article>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl">طلبات اليوم</h2>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4" /> تحديث
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">لا توجد طلبات اليوم بعد</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="font-bold mb-3">لم يُرد عليها ({pending.length})</h3>
            <div className="space-y-3">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">تم الرد على كل الطلبات ✅</p>
              ) : (
                pending.map((o) => <Card key={o.id} o={o} />)
              )}
            </div>
          </section>
          <section>
            <h3 className="font-bold mb-3">تم الرد ({done.length})</h3>
            <div className="space-y-3 opacity-70">
              {done.map((o) => <Card key={o.id} o={o} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default OrdersPanel;
