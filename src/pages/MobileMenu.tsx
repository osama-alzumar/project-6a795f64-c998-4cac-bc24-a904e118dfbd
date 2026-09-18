import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, ChevronDown, MapPin, Minus, Phone, Plus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import dripLogo from "@/assets/julith/julith-logo.jpg.asset.json";
import julithPattern from "@/assets/julith/julith-pattern-background.jpeg.asset.json";
import { buildOrderText, CALL_NUMBER, openWhatsApp, saveOrder } from "@/lib/order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Category = { id: string; name: string; sort_order: number };
type Product = { id: string; category_id: string; name: string; price: number; image_url: string | null; is_available: boolean; sort_order: number };
type Branch = {
  id: string;
  name: string;
  sort_order: number;
  address: string | null;
  image_url: string | null;
  pattern_url: string | null;
};

const BRANCH_STORAGE_KEY = "julith-mobile-branch";

const MobileMenu = () => {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [productBranches, setProductBranches] = useState<{ product_id: string; branch_id: string }[]>([]);
  const [branchId, setBranchId] = useState("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }, { data: b }, { data: availability }] = await Promise.all([
        supabase.from("categories").select("id,name,sort_order").order("sort_order"),
        supabase.from("products").select("id,category_id,name,price,image_url,is_available,sort_order").eq("is_available", true).order("sort_order"),
        supabase.from("branches").select("id,name,sort_order,address,image_url,pattern_url").order("sort_order"),
        supabase.from("product_branches").select("product_id,branch_id"),
      ]);
      setCats(c ?? []);
      setProds(p ?? []);
      setBranches(b ?? []);
      setProductBranches(availability ?? []);
      if (!b?.length) return;
      const savedBranchId = window.localStorage.getItem(BRANCH_STORAGE_KEY);
      const validSavedBranch = b.some((item) => item.id === savedBranchId);
      if (validSavedBranch && savedBranchId) setBranchId(savedBranchId);
      else if (b.length === 1) setBranchId(b[0].id);
      else setBranchDialogOpen(true);
    })();
  }, []);

  const selectBranch = (id: string) => {
    setBranchId(id);
    window.localStorage.setItem(BRANCH_STORAGE_KEY, id);
    setQty({});
    setBranchDialogOpen(false);
  };

  const change = (id: string, delta: number) =>
    setQty((q) => {
      const next = Math.max(0, (q[id] ?? 0) + delta);
      const copy = { ...q };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const visibleProducts = branchId && productBranches.length > 0
    ? prods.filter((product) => productBranches.some((item) => item.branch_id === branchId && item.product_id === product.id))
    : prods;
  const items = visibleProducts
    .filter((p) => qty[p.id])
    .map((p) => ({ id: p.id, name: p.name, price: Number(p.price), qty: qty[p.id] }));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const branch = branches.find((b) => b.id === branchId) ?? null;
  const activePattern = branch?.pattern_url ?? julithPattern.url;

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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground pb-36">
      <Helmet>
        <title>منيو جوليث للجوال — اطلب عبر واتساب</title>
        <meta name="description" content="منيو جوليث Julith لشاشة الجوال: تصفّح الأصناف واطلب مباشرة عبر واتساب أو اتصل بالفرع." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="canonical" href="/m" />
      </Helmet>

      <img src={activePattern} alt="" aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-[0.045] mix-blend-multiply" />

      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <img src={branch?.image_url ?? dripLogo.url} alt={branch ? `فرع ${branch.name}` : "جوليث Julith"} className="w-10 h-10 rounded-full object-cover" />
          <div className="flex-1">
            <p className="font-latin font-bold text-lg leading-none text-olive">Julith</p>
            <p className="text-xs text-muted-foreground mt-0.5">{branch ? `فرع ${branch.name}` : "منيو الجوال"}</p>
          </div>
          {branches.length > 0 && (
            <Button variant="outline" size="sm" className="h-9 gap-1 px-2" onClick={() => setBranchDialogOpen(true)}>
              <MapPin className="h-4 w-4" />
              <span className="max-w-20 truncate">{branch?.name ?? "اختر الفرع"}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          )}
          <a href={`tel:${CALL_NUMBER}`} className="w-9 h-9 rounded-full bg-olive/10 text-olive flex items-center justify-center" aria-label="اتصال">
            <Phone className="w-4 h-4" />
          </a>
        </div>
      </header>

      {branch?.image_url && (
        <div className="relative z-10 mx-4 mt-4 aspect-[16/7] overflow-hidden rounded-lg">
          <img src={branch.image_url} alt={`صورة فرع ${branch.name}`} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-secondary/90 to-transparent px-4 pb-3 pt-10 text-secondary-foreground">
            <p className="font-bold">فرع {branch.name}</p>
            {branch.address && <p className="mt-0.5 text-xs opacity-90">{branch.address}</p>}
          </div>
        </div>
      )}

      <main className="relative z-10 px-4 py-4 space-y-7">
        {cats.map((cat) => {
          const list = visibleProducts.filter((p) => p.category_id === cat.id);
          if (!list.length) return null;
          return (
            <section key={cat.id}>
              <h2 className="text-lg font-bold mb-3">{cat.name}</h2>
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/90 px-3 py-2.5 backdrop-blur-sm">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />}
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

      <Dialog open={branchDialogOpen} onOpenChange={(open) => setBranchDialogOpen(open || !branchId)}>
        <DialogContent className="left-4 right-4 top-auto bottom-4 w-auto max-w-none translate-x-0 translate-y-0 gap-3 rounded-lg p-4 sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%]">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>اختر الفرع</DialogTitle>
            <DialogDescription>ستتغير القائمة والصورة والنقش حسب الفرع المختار.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {branches.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start overflow-hidden p-0 text-right"
                onClick={() => selectBranch(item.id)}
              >
                <img src={item.image_url ?? dripLogo.url} alt={`فرع ${item.name}`} className="h-20 w-24 shrink-0 object-cover" />
                <span className="min-w-0 flex-1 px-3 py-2">
                  <span className="block font-bold">{item.name}</span>
                  {item.address && <span className="mt-1 block truncate text-xs text-muted-foreground">{item.address}</span>}
                </span>
                {item.id === branchId && <Check className="ml-3 h-5 w-5 shrink-0 text-primary" />}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
