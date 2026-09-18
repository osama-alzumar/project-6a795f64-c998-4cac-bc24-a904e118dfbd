import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, RefreshCw, Clock, MapPin, PackageCheck, UserX } from "lucide-react";

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

  const STATUS_LABEL: Record<string, string> = {
    new: "بانتظار الرد",
    answered: "تم الرد",
    delivered: "تم التسليم",
    no_show: "لم يحضر العميل",
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("تعذّر تحديث الحالة");
    else {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      toast.success(`تم التحديث: ${STATUS_LABEL[status] ?? status}`);
    }
  };

  const pending = orders.filter((o) => o.status === "new" || o.status === "answered");
  const delivered = orders.filter((o) => o.status === "delivered");
  const noShow = orders.filter((o) => o.status === "no_show");

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
        <div className="text-left shrink-0">
          <span className="font-bold text-olive whitespace-nowrap block">{o.total.toFixed(2)} ر.س</span>
          <span className="text-xs text-muted-foreground">{STATUS_LABEL[o.status] ?? o.status}</span>
        </div>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1">
        {o.items.map((i, idx) => (
          <li key={`${o.id}-${idx}`}>• {i.name} ×{i.qty}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {o.status === "new" && (
          <Button size="sm" onClick={() => setStatus(o.id, "answered")}>
            <Check className="w-4 h-4" /> تم الرد على العميل
          </Button>
        )}
        {(o.status === "answered" || o.status === "new") && (
          <Button size="sm" variant="secondary" onClick={() => setStatus(o.id, "delivered")}>
            <PackageCheck className="w-4 h-4" /> تم التسليم
          </Button>
        )}
        {o.status === "answered" && (
          <Button size="sm" variant="destructive" onClick={() => setStatus(o.id, "no_show")}>
            <UserX className="w-4 h-4" /> لم يحضر العميل
          </Button>
        )}
        {o.status !== "new" && (
          <Button variant="outline" size="sm" onClick={() => setStatus(o.id, "new")}>
            <RefreshCw className="w-4 h-4" /> إرجاع للانتظار
          </Button>
        )}
      </div>
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
            <h3 className="font-bold mb-3">قيد المتابعة ({pending.length})</h3>
            <div className="space-y-3">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد طلبات قيد المتابعة ✅</p>
              ) : (
                pending.map((o) => <Card key={o.id} o={o} />)
              )}
            </div>
          </section>
          <section>
            <h3 className="font-bold mb-3">تم التسليم ({delivered.length})</h3>
            <div className="space-y-3 opacity-70">
              {delivered.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد طلبات مسلّمة بعد</p>
              ) : (
                delivered.map((o) => <Card key={o.id} o={o} />)
              )}
            </div>
          </section>
          <section>
            <h3 className="font-bold mb-3">لم يحضر العميل ({noShow.length})</h3>
            <div className="space-y-3 opacity-70">
              {noShow.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا يوجد</p>
              ) : (
                noShow.map((o) => <Card key={o.id} o={o} />)
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default OrdersPanel;
