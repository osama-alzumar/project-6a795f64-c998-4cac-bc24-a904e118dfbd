import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Coffee, Plus, Instagram, ShoppingBag, Trash2, Minus, Gift } from "lucide-react";
import heroCup from "@/assets/cupwink-hero.jpg.asset.json";
import dripLogo from "@/assets/cupwink-logo.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";


const useScrollReveal = (deps: unknown[] = []) => {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string; category_id: string; name: string; price: number;
  image_url: string | null; sort_order: number; is_available: boolean;
};

type CartItem = Product & { qty: number };

const Index = () => {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [openCart, setOpenCart] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("*").eq("is_available", true).order("sort_order"),
      ]);
      setCats(c ?? []);
      setProds(p ?? []);
    })();
  }, []);

  useEffect(() => {
    try {
      const KEY = "drip_visit";
      if (sessionStorage.getItem(KEY)) return;
      let sid = localStorage.getItem("drip_sid");
      if (!sid) { sid = crypto.randomUUID(); localStorage.setItem("drip_sid", sid); }
      supabase.from("site_visits").insert({
        session_id: sid,
        path: window.location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        language: navigator.language,
        screen_size: `${window.screen.width}x${window.screen.height}`,
      }).then(() => sessionStorage.setItem(KEY, "1"));
    } catch {/* ignore */}
  }, []);

  useScrollReveal([cats.length, prods.length]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success("تمت الإضافة للسلة", { description: product.name });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));
  const incQty = (id: string) => setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const decQty = (id: string) => setCart((prev) => prev.map((i) => (i.id === id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0));

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <Drawer open={openCart} onOpenChange={setOpenCart}>
      <Helmet>
        <title>CupWink كوب ونك — قهوتك كما يجب أن تكون</title>
        <meta name="description" content="CupWink (كوب ونك) — قهوة مختصة ومشروبات وحلويات بطعم مميز. اطلع على المنيو والأسعار بالريال السعودي." />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="min-h-screen text-foreground overflow-x-hidden">
        {/* NAV */}
        <header className="absolute top-0 inset-x-0 z-30">
          <div className="container flex items-center justify-between py-5">
            <a href="#" className="flex items-center gap-2">
              <span className="font-latin text-2xl font-bold text-olive">CupWink</span>
              <span className="text-base font-bold text-olive/80">كوب ونك</span>
            </a>
            <a href="#menu" className="text-sm font-medium text-foreground/70 hover:text-olive transition-colors">
              المنيو
            </a>
          </div>
        </header>

        {/* Floating Cart Button */}
        <DrawerTrigger asChild>
          <button
            type="button"
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-olive text-white shadow-lg flex items-center justify-center hover:bg-olive/90 transition-colors"
            aria-label="السلة"
          >
            <ShoppingBag className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-caramel text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </DrawerTrigger>

        {/* HERO */}
        <section className="relative min-h-[100svh] flex items-center pt-24 pb-16 overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(150_40%_94%)] via-[hsl(150_35%_92%)] to-[hsl(150_30%_86%)]" />
            <div className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-[hsl(158_42%_24%)]/10 blur-3xl" />
            <div className="absolute -bottom-32 -right-10 w-[480px] h-[480px] rounded-full bg-[hsl(145_45%_50%)]/15 blur-3xl" />
          </div>

          <div className="container grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="text-center lg:text-right order-2 lg:order-1">
              <p className="font-latin tracking-[0.45em] text-xs md:text-sm text-olive/80 mb-5 reveal">
                SPECIALTY COFFEE
              </p>
              <h1 className="reveal">
                <span className="block font-latin text-6xl md:text-7xl lg:text-8xl font-extrabold text-olive leading-none">
                  CupWink
                </span>
                <span className="block text-3xl md:text-4xl font-extrabold text-foreground/85 mt-3">
                  كوب ونك
                </span>
                <span className="sr-only"> — قهوة مختصة وحلويات</span>
              </h1>
              <div className="divider-dot mt-6">
                <span className="w-2 h-2 rounded-full bg-caramel" />
              </div>
              <p className="text-xl md:text-2xl text-foreground/75 font-bold mt-4 reveal">
                قهوتك، كما يجب أن تكون
              </p>
              <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto lg:mx-0 mt-4 leading-relaxed reveal">
                جرب السعادة بطعمها الحلو — قهوة مختصة، مشروبات منعشة،
                وحلويات تجمعك على لحظة مميزة.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start reveal">
                <a href="https://rasid.pro/join/dd/register" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ background: 'var(--gradient-caramel)' }}>
                  <Gift className="w-4 h-4" /> نظام الولاء
                </a>
                <a href="#menu" className="btn-primary">
                  تصفّح المنيو
                </a>
                <a href="tel:0573881918" className="btn-primary" style={{ background: 'transparent', color: 'hsl(var(--olive))', border: '2px solid hsl(var(--olive))', boxShadow: 'none' }}>
                  اتصل لتجهيز طلبك
                </a>
              </div>
            </div>

            <div className="relative order-1 lg:order-2 reveal">
              <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(158_42%_24%)]/15 to-transparent rounded-[3rem] blur-2xl" />
              <img
                src={heroCup.url}
                alt="كوب CupWink مع نعناع وحبوب قهوة"
                className="relative w-full max-w-[560px] mx-auto rounded-[2.5rem] shadow-soft object-cover"
              />
            </div>
          </div>
        </section>

        {/* MENU */}
        <section id="menu" className="relative py-20 md:py-28">
          <div className="container">
            <div className="text-center mb-12 reveal">
              <p className="font-latin tracking-[0.4em] text-xs text-caramel mb-3">M E N U</p>
              <h2 className="text-4xl md:text-5xl text-foreground">المنيو</h2>
              <div className="divider-dot mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-olive" />
              </div>
              
            </div>

            {/* Categories + Products */}
            <div className="space-y-16 max-w-6xl mx-auto">
              {cats.map((cat) => {
                const items = prods.filter((p) => p.category_id === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-4 mb-8 reveal">
                      <h3 className="text-2xl md:text-3xl font-bold text-foreground">{cat.name}</h3>
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-transparent" />
                      <span className="text-sm text-muted-foreground">{items.length} صنف</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {items.map((item) => (
                        <article key={item.id} className="product-card reveal">
                          <div className="relative aspect-square bg-muted overflow-hidden">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={`${item.name} — CupWink`}
                                loading="lazy"
                                width={768}
                                height={768}
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Coffee className="w-10 h-10 text-olive/40" />
                              </div>
                            )}
                          </div>
                          <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 flex-1">
                            <h4 className="font-bold text-sm sm:text-base md:text-lg text-foreground line-clamp-1 leading-tight">
                              {item.name}
                            </h4>
                            <div className="flex items-center justify-between mt-auto gap-1 sm:gap-2 min-w-0">
                              <span className="font-bold text-olive text-sm sm:text-lg shrink-0">
                                {Number(item.price).toFixed(2)}
                                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium me-1">ر.س</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="btn-soft shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs"
                                aria-label={`أضف ${item.name} للسلة`}
                              >
                                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                أضف
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="relative mt-12 bg-[hsl(158_50%_12%)] text-[hsl(150_35%_95%)]">
          <div className="container py-16 text-center">
            <img
              src={dripLogo.url}
              alt="CupWink كوب ونك"
              className="w-28 mx-auto mb-6 rounded-xl bg-white p-2"
            />
            <p className="font-latin text-3xl text-[hsl(145_45%_70%)] tracking-wider font-extrabold">CupWink</p>
            <p className="text-xl mt-1 font-bold">كوب ونك</p>
            <p className="text-[hsl(150_35%_95%)]/75 mt-3">قهوتك، كما يجب أن تكون</p>
            <p className="text-[hsl(150_35%_95%)]/60 mt-2 text-sm" dir="ltr">📞 0573881918</p>

            <div className="flex justify-center gap-4 mt-8">
              <a
                href="#"
                aria-label="انستقرام"
                className="w-11 h-11 rounded-full bg-[hsl(150_35%_95%)]/10 hover:bg-[hsl(145_45%_50%)]/30 flex items-center justify-center transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>

            <div className="mt-10 pt-6 border-t border-[hsl(150_35%_95%)]/10 text-sm text-[hsl(150_35%_95%)]/60">
              © {new Date().getFullYear()} CupWink كوب ونك — جميع الحقوق محفوظة
            </div>
          </div>
        </footer>
      </div>

      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>السلة</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">السلة فارغة</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/60">
                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Coffee className="w-5 h-5 text-olive/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{Number(item.price).toFixed(2)} ر.س</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decQty(item.id)}
                      className="w-7 h-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors"
                      aria-label="نقص"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => incQty(item.id)}
                      className="w-7 h-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors"
                      aria-label="زيادة"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                    aria-label="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="pt-3 border-t flex items-center justify-between">
                <span className="font-bold">الإجمالي</span>
                <span className="font-bold text-olive">{cartTotal.toFixed(2)} ر.س</span>
              </div>
              <p className="text-center text-xs text-muted-foreground pt-2">
                السلة للتجميع فقط — اطلب من الكاشير
              </p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default Index;
