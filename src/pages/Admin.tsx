import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrdersPanel from "@/components/admin/OrdersPanel";
import SalesPanel from "@/components/admin/SalesPanel";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Pencil, Plus, LogOut, ArrowRight, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react";

type Category = { id: string; name: string; sort_order: number; image_url?: string | null };
type Product = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
};
type Branch = {
  id: string;
  name: string;
  sort_order: number;
  address?: string | null;
  maps_url?: string | null;
  image_url?: string | null;
  pattern_url?: string | null;
};

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pb, setPb] = useState<{ product_id: string; branch_id: string }[]>([]);

  // forms
  const [newCat, setNewCat] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat] = useState<string>("");
  const [pFile, setPFile] = useState<File | null>(null);
  const [pSubmitting, setPSubmitting] = useState(false);

  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);

  // Branch form
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");
  const [newBranchMaps, setNewBranchMaps] = useState("");
  const [uploadingBranchField, setUploadingBranchField] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate("/auth");
        return;
      }
      const uid = sess.session.user.id;
      if (!mounted) return;
      setUserId(uid);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      let admin = !!roles?.some((r) => r.role === "admin");
      if (!admin) {
        const { data: claimed } = await supabase.rpc("claim_first_admin");
        if (claimed) admin = true;
      }
      setIsAdmin(admin);
      await loadData();
      setLoading(false);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const loadData = async () => {
    const [{ data: c }, { data: p }, { data: b }, { data: m }] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("branches").select("*").order("sort_order"),
      supabase.from("product_branches").select("*"),
    ]);
    setCats(c ?? []);
    setProds(p ?? []);
    setBranches(b ?? []);
    setPb(m ?? []);
  };

  const toggleProductBranch = async (productId: string, branchId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase.from("product_branches").insert({ product_id: productId, branch_id: branchId });
      if (error) return toast.error(error.message);
      setPb((prev) => [...prev, { product_id: productId, branch_id: branchId }]);
    } else {
      const { error } = await supabase.from("product_branches").delete().eq("product_id", productId).eq("branch_id", branchId);
      if (error) return toast.error(error.message);
      setPb((prev) => prev.filter((x) => !(x.product_id === productId && x.branch_id === branchId)));
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Categories
  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase
      .from("categories")
      .insert({ name: newCat.trim(), sort_order: cats.length });
    if (error) return toast.error(error.message);
    setNewCat("");
    toast.success("تمت إضافة الفئة");
    loadData();
  };
  const updateCategory = async (id: string) => {
    const { error } = await supabase.from("categories").update({ name: editingCatName }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingCatId(null);
    loadData();
  };
  const deleteCategory = async (id: string) => {
    if (!confirm("حذف الفئة وكل منتجاتها؟")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadData();
  };

  // Products
  const uploadImage = async (file: File, folder = "products"): Promise<string | null> => {
    if (!userId) return null;
    const ext = file.name.split(".").pop();
    const path = `${userId}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const updateBranchVisual = async (
    branchId: string,
    field: "image_url" | "pattern_url",
    file: File,
  ) => {
    const uploadKey = `${branchId}-${field}`;
    setUploadingBranchField(uploadKey);
    const imageUrl = await uploadImage(file, `branches/${branchId}/${field}`);
    if (!imageUrl) {
      setUploadingBranchField(null);
      return;
    }
    const update = field === "image_url" ? { image_url: imageUrl } : { pattern_url: imageUrl };
    const { error } = await supabase.from("branches").update(update).eq("id", branchId);
    setUploadingBranchField(null);
    if (error) return toast.error(error.message);
    setBranches((prev) => prev.map((branch) => branch.id === branchId ? { ...branch, [field]: imageUrl } : branch));
    toast.success(field === "image_url" ? "تم حفظ صورة الفرع تلقائيًا" : "تم حفظ نقش الفرع تلقائيًا");
  };
  const updateCategoryImage = async (id: string, file: File | null) => {
    let image_url: string | null = null;
    if (file) {
      image_url = await uploadImage(file);
      if (!image_url) return;
    }
    const { error } = await supabase.from("categories").update({ image_url }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(file ? "تم تحديث الصورة" : "تم إزالة الصورة");
    loadData();
  };

  const addProduct = async () => {
    if (!pName.trim() || !pCat) return toast.error("الاسم والفئة مطلوبة");
    setPSubmitting(true);
    let image_url: string | null = null;
    if (pFile) image_url = await uploadImage(pFile);
    const { data: inserted, error } = await supabase.from("products").insert({
      name: pName.trim(),
      price: Number(pPrice) || 0,
      category_id: pCat,
      image_url,
      sort_order: prods.filter((p) => p.category_id === pCat).length,
    }).select().single();
    if (!error && inserted && branches.length > 0) {
      await supabase.from("product_branches").insert(
        branches.map((b) => ({ product_id: inserted.id, branch_id: b.id }))
      );
    }
    setPSubmitting(false);
    if (error) return toast.error(error.message);
    setPName("");
    setPPrice("");
    setPFile(null);
    toast.success("تمت إضافة المنتج");
    loadData();
  };

  const saveEdit = async () => {
    if (!editingProd) return;
    let image_url = editingProd.image_url;
    if (editFile) {
      const url = await uploadImage(editFile);
      if (url) image_url = url;
    }
    const { error } = await supabase
      .from("products")
      .update({
        name: editingProd.name,
        price: editingProd.price,
        category_id: editingProd.category_id,
        is_available: editingProd.is_available,
        image_url,
      })
      .eq("id", editingProd.id);
    if (error) return toast.error(error.message);
    setEditingProd(null);
    setEditFile(null);
    loadData();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("حذف المنتج؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadData();
  };

  const updateSortOrder = async (
    table: "categories" | "products" | "branches",
    id: string,
    value: number
  ) => {
    const setter =
      table === "categories" ? setCats : table === "products" ? setProds : setBranches;
    (setter as any)((prev: any[]) =>
      prev.map((x) => (x.id === id ? { ...x, sort_order: value } : x))
    );
    const { error } = await supabase.from(table).update({ sort_order: value }).eq("id", id);
    if (error) {
      toast.error("فشل تغيير الترتيب");
      loadData();
    }
  };

  const moveCategory = async (index: number, direction: "up" | "down") => {
    const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    const updates = sorted.map((c, i) => ({ id: c.id, sort_order: i }));
    setCats(updates as Category[]);
    for (const u of updates) {
      const { error } = await supabase.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) {
        toast.error("فشل حفظ الترتيب");
        return loadData();
      }
    }
    toast.success("تم تحديث الترتيب");
    loadData();
  };


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  if (!isAdmin) {
    const claimAdmin = async () => {
      const { data } = await supabase.rpc("claim_first_admin");
      if (data) {
        toast.success("تم منح صلاحية الأدمن");
        setIsAdmin(true);
      } else {
        toast.error("لا يمكن منح الصلاحية — يوجد أدمن مسبقاً");
      }
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center bg-card border border-border rounded-2xl p-8 space-y-4">
          <h2 className="font-display text-2xl">لا تملك صلاحية الإدارة</h2>
          <p className="text-muted-foreground text-sm">
            تواصل مع المالك لإضافتك كأدمن، أو اضغط الزر أدناه.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={claimAdmin} className="bg-gold text-cream">احصل على صلاحية الأدمن</Button>
            <Button onClick={logout} variant="outline">تسجيل الخروج</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>لوحة التحكم — جوليث</title>
        <meta name="description" content="لوحة إدارة جوليث لإدارة الفئات والمنتجات والفروع." />
        <link rel="canonical" href="https://voute-elegant-landing.lovable.app/admin" />
        <meta property="og:title" content="لوحة التحكم — جوليث" />
        <meta property="og:description" content="لوحة إدارة جوليث لإدارة الفئات والمنتجات والفروع." />
        <meta property="og:url" content="https://voute-elegant-landing.lovable.app/admin" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
    <div className="min-h-screen bg-background py-6 px-3 sm:py-8 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            
            <p className="text-sm text-muted-foreground">إدارة الفئات والمنتجات</p>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="w-full sm:w-auto"><ArrowRight className="w-4 h-4 ml-1" /> الموقع</Button>
            </Link>
            <Button onClick={logout} variant="outline" size="sm" className="flex-1 sm:flex-none">
              <LogOut className="w-4 h-4 ml-1" /> خروج
            </Button>
          </div>
        </header>

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="menu">المنيو</TabsTrigger>
            <TabsTrigger value="orders">طلبات اليوم</TabsTrigger>
            <TabsTrigger value="sales">المبيعات</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-6">
            <OrdersPanel />
          </TabsContent>
          <TabsContent value="sales" className="mt-6">
            <SalesPanel />
          </TabsContent>

          <TabsContent value="menu" className="mt-6 space-y-6 sm:space-y-8">

        {/* Categories */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-xl">الفئات</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="اسم فئة جديدة"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <Button onClick={addCategory} className="bg-gold text-cream hover:opacity-90 w-full sm:w-auto">
              <Plus className="w-4 h-4 ml-1" /> إضافة
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {[...cats].sort((a, b) => a.sort_order - b.sort_order).map((c, index, arr) => (
              <li key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-3">
                {editingCatId === c.id ? (
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <Input
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                    />
                    <div className="grid grid-cols-2 sm:flex gap-2">
                      <Button size="sm" onClick={() => updateCategory(c.id)}>حفظ</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCatId(null)}>إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium truncate">{c.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-8 w-8" disabled={index === 0} onClick={() => moveCategory(index, "up")}>
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" disabled={index === arr.length - 1} onClick={() => moveCategory(index, "down")}>
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <Label htmlFor={`cat-img-${c.id}`} className="cursor-pointer text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
                        {c.image_url ? "تغيير الصورة" : "رفع صورة"}
                      </Label>
                      <input
                        id={`cat-img-${c.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) updateCategoryImage(c.id, f);
                        }}
                      />
                      {c.image_url && (
                        <Button size="sm" variant="ghost" onClick={() => updateCategoryImage(c.id, null)}>
                          إزالة
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteCategory(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Add product */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-xl">إضافة منتج</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الاسم</Label>
              <Input value={pName} onChange={(e) => setPName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>السعر (ر.س)</Label>
              <Input type="number" step="0.01" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>الفئة</Label>
              <Select value={pCat} onValueChange={setPCat}>
                <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>صورة المنتج</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Button onClick={addProduct} disabled={pSubmitting} className="bg-gold text-cream hover:opacity-90 w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-1" /> {pSubmitting ? "جاري..." : "إضافة المنتج"}
          </Button>
        </section>

        {/* Products list */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-xl">المنتجات</h2>
          <p className="text-xs text-muted-foreground">اكتب رقم الترتيب لكل منتج (الأصغر يظهر أولاً) داخل قسمه.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...prods].sort((a, b) => {
              if (a.category_id !== b.category_id) {
                const ca = cats.find((c) => c.id === a.category_id)?.sort_order ?? 0;
                const cb = cats.find((c) => c.id === b.category_id)?.sort_order ?? 0;
                return ca - cb;
              }
              return a.sort_order - b.sort_order;
            }).map((p) => {
              const cat = cats.find((c) => c.id === p.category_id);
              const editing = editingProd?.id === p.id;
              return (
                <div key={p.id} className="border border-border rounded-xl overflow-hidden bg-background">
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    {editing ? (
                      <>
                        <Input value={editingProd!.name} onChange={(e) => setEditingProd({ ...editingProd!, name: e.target.value })} />
                        <Input type="number" step="0.01" value={editingProd!.price} onChange={(e) => setEditingProd({ ...editingProd!, price: Number(e.target.value) })} />
                        <Select value={editingProd!.category_id} onValueChange={(v) => setEditingProd({ ...editingProd!, category_id: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="file" accept="image/*" onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} />
                        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-background cursor-pointer">
                          <span className="text-sm font-medium">{editingProd!.is_available ? "متوفر — يظهر للعملاء" : "غير متوفر — مخفي"}</span>
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-gold"
                            checked={editingProd!.is_available}
                            onChange={(e) => setEditingProd({ ...editingProd!, is_available: e.target.checked })}
                          />
                        </label>
                        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 bg-background pt-3 border-t border-border">
                          <Button onClick={saveEdit} className="h-11 w-full font-semibold">حفظ التغييرات</Button>
                          <Button className="h-11 w-full" variant="outline" onClick={() => { setEditingProd(null); setEditFile(null); }}>إلغاء</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-semibold">{p.name}</h3>
                          <span className="text-gold font-semibold">{p.price} ر.س</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{cat?.name}</p>
                        <div className="pt-2 border-t border-border/60">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">متوفر في الفروع:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {branches.map((b) => {
                              const checked = pb.some((x) => x.product_id === p.id && x.branch_id === b.id);
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => toggleProductBranch(p.id, b.id, !checked)}
                                  className={`text-[11px] px-2 py-1 rounded-full border transition ${
                                    checked
                                      ? "bg-gold text-cream border-gold"
                                      : "bg-background text-muted-foreground border-border hover:border-gold/60"
                                  }`}
                                >
                                  {b.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-1 pt-1 items-center">
                          <div className="flex items-center gap-1 mr-auto">
                            <Label className="text-[11px] text-muted-foreground">ترتيب</Label>
                            <Input
                              type="number"
                              className="h-8 w-16"
                              value={p.sort_order}
                              onChange={(e) =>
                                setProds((prev) =>
                                  prev.map((x) => (x.id === p.id ? { ...x, sort_order: Number(e.target.value) } : x))
                                )
                              }
                            />
                            <Button size="sm" variant="outline" className="h-8" onClick={() => updateSortOrder("products", p.id, p.sort_order)}>
                              حفظ
                            </Button>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => setEditingProd(p)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteProduct(p.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Branches */}
        <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-xl">الفروع</h2>
          <p className="text-xs text-muted-foreground">حدّث بيانات الفرع وصورته ونقشه. تُحفظ الصور تلقائيًا فور اختيارها.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 border border-dashed border-border rounded-xl p-3 bg-background">
            <Input
              placeholder="اسم الفرع الجديد"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <Input
              placeholder="العنوان (الحي/الشارع)"
              value={newBranchAddress}
              onChange={(e) => setNewBranchAddress(e.target.value)}
            />
            <Input
              placeholder="رابط Google Maps"
              value={newBranchMaps}
              onChange={(e) => setNewBranchMaps(e.target.value)}
            />
            <div className="sm:col-span-2 lg:col-span-3 flex justify-stretch sm:justify-end">
              <Button
                className="bg-gold text-cream hover:opacity-90 w-full sm:w-auto h-11 font-semibold"
                onClick={async () => {
                  if (!newBranchName.trim()) return toast.error("اسم الفرع مطلوب");
                  const { error } = await supabase.from("branches").insert({
                    name: newBranchName.trim(),
                    address: newBranchAddress.trim() || null,
                    maps_url: newBranchMaps.trim() || null,
                    sort_order: branches.length,
                  });
                  if (error) return toast.error(error.message);
                  setNewBranchName(""); setNewBranchAddress(""); setNewBranchMaps("");
                  toast.success("تمت إضافة الفرع");
                  loadData();
                }}
              >
                <Plus className="w-4 h-4 ml-1" /> حفظ وإضافة الفرع
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {branches.map((b) => (
              <div key={b.id} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 border border-border rounded-xl p-3 bg-background">
                <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 gap-3">
                  {([
                    { field: "image_url" as const, label: "صورة الفرع", value: b.image_url },
                    { field: "pattern_url" as const, label: "نقش الفرع", value: b.pattern_url },
                  ]).map(({ field, label, value }) => {
                    const inputId = `${field}-${b.id}`;
                    const uploading = uploadingBranchField === `${b.id}-${field}`;
                    return (
                      <div key={field} className="overflow-hidden rounded-lg border border-border bg-muted/40">
                        <div className="aspect-[16/9] flex items-center justify-center overflow-hidden">
                          {value ? (
                            <img src={value} alt={`${label} ${b.name}`} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <Label
                          htmlFor={inputId}
                          className="flex min-h-10 cursor-pointer items-center justify-center border-t border-border px-2 text-xs font-semibold hover:bg-muted"
                        >
                          {uploading ? "جارٍ الرفع…" : value ? `تغيير ${label}` : `رفع ${label}`}
                        </Label>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) updateBranchVisual(b.id, field, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <Input
                  placeholder="اسم الفرع"
                  value={b.name}
                  onChange={(e) => setBranches((prev) => prev.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                />
                <Input
                  placeholder="العنوان (الحي/الشارع)"
                  value={b.address ?? ""}
                  onChange={(e) => setBranches((prev) => prev.map((x) => x.id === b.id ? { ...x, address: e.target.value } : x))}
                />
                <Input
                  placeholder="رابط Google Maps"
                  value={b.maps_url ?? ""}
                  onChange={(e) => setBranches((prev) => prev.map((x) => x.id === b.id ? { ...x, maps_url: e.target.value } : x))}
                />
                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">ترتيب العرض</Label>
                    <Input
                      type="number"
                      className="h-9 w-20"
                      value={b.sort_order}
                      onChange={(e) => setBranches((prev) => prev.map((x) => x.id === b.id ? { ...x, sort_order: Number(e.target.value) } : x))}
                    />
                  </div>
                  <div className="flex gap-2 flex-1 sm:flex-none justify-end">
                    <Button
                      className="bg-gold text-cream hover:opacity-90 h-10 font-semibold flex-1 sm:flex-none"
                      onClick={async () => {
                        const { error } = await supabase.from("branches").update({
                          name: b.name,
                          address: b.address,
                          maps_url: b.maps_url,
                          sort_order: b.sort_order,
                        }).eq("id", b.id);
                        if (error) return toast.error(error.message);
                        toast.success("تم حفظ الفرع");
                      }}
                    >
                      حفظ التغييرات
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("حذف الفرع؟")) return;
                        const { error } = await supabase.from("branches").delete().eq("id", b.id);
                        if (error) return toast.error(error.message);
                        toast.success("تم الحذف");
                        loadData();
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
};

export default Admin;
