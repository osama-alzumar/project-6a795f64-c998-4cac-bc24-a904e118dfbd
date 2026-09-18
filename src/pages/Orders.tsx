import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, Check, RefreshCw, Clock, MapPin } from "lucide-react";

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

const Orders = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sess.session.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await load();
      setLoading(false);
    })();
  }, [navigate, load]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const poll = setInterval(() => load(), 30000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("تعذّر تحديث الحالة");
    else {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      toast.success(status === "answered" ? "تم وضع علامة: تم الرد" : "أُعيد الطلب لقائمة الانتظار");
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">جارٍ التحميل…</div>;
  if (!isAdmin)
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <p className="font-bold text-lg">هذه الصفحة للكاشير فقط</p>
          <Link to="/" className="text-olive underline text-sm mt-2 inline-block">العودة للمنيو</Link>
        </div>
      </div>
    );

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
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>طلبات اليوم — جوليث</title>
        <meta name="description" content="متابعة طلبات اليوم في جوليث: الفرع، الوقت، وحالة الرد على العميل." />
      </Helmet>
      <div className="container py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">طلبات اليوم</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4" /> تحديث
            </Button>
            <Link to="/sales">
              <Button variant="ghost" size="sm">المبيعات</Button>
            </Link>
            <Link to="/admin">
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4" /> الإدارة
              </Button>
            </Link>
          </div>
        </div>

        {orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">لا توجد طلبات اليوم بعد</p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="font-bold mb-3">لم يُرد عليها ({pending.length})</h2>
              <div className="space-y-3">
                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">تم الرد على كل الطلبات ✅</p>
                ) : (
                  pending.map((o) => <Card key={o.id} o={o} />)
                )}
              </div>
            </section>
            <section>
              <h2 className="font-bold mb-3">تم الرد ({done.length})</h2>
              <div className="space-y-3 opacity-70">
                {done.map((o) => <Card key={o.id} o={o} />)}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
