import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function strengthScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function strengthLabel(s: number) {
  if (s <= 1) return { text: "ضعيفة جداً", color: "bg-red-500" };
  if (s === 2) return { text: "ضعيفة", color: "bg-orange-500" };
  if (s === 3) return { text: "متوسطة", color: "bg-yellow-500" };
  if (s === 4) return { text: "جيدة", color: "bg-emerald-500" };
  return { text: "قوية جداً", color: "bg-emerald-600" };
}

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => strengthScore(password), [password]);
  const { text, color } = strengthLabel(score);

  const toEmail = (u: string) =>
    `${u.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")}@voute.local`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/admin");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = toEmail(username);
      if (!email.startsWith("@") === false || email.length < 5) throw new Error("اسم مستخدم غير صالح");
      if (mode === "signup" && score < 3) throw new Error("كلمة المرور ضعيفة — استخدم 8+ أحرف مع أرقام ورموز");
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message ?? "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>تسجيل الدخول — Drip Story</title>
        <meta name="description" content="سجّل دخولك إلى لوحة Drip Story لإدارة المنيو والفروع." />
        <link rel="canonical" href="https://voute-classic-oasis.lovable.app/auth" />
        <meta property="og:title" content="تسجيل الدخول — Drip Story" />
        <meta property="og:description" content="سجّل دخولك إلى لوحة Drip Story لإدارة المنيو والفروع." />
        <meta property="og:url" content="https://voute-classic-oasis.lovable.app/auth" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-elegant space-y-5"
      >
        <h1 className="font-display text-3xl text-center text-foreground">
          {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>
        

        <div className="space-y-2">
          <Label htmlFor="username">اسم المستخدم</Label>
          <Input id="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" && password.length > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${(score / 5) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">قوة كلمة المرور: <span className="font-medium text-foreground">{text}</span></p>
            </div>
          )}
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-gold hover:opacity-90 text-cream">
          {loading ? "..." : mode === "login" ? "دخول" : "تسجيل"}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="block mx-auto text-sm text-muted-foreground hover:text-gold transition-colors"
        >
          {mode === "login" ? "ليس لديك حساب؟ أنشئ واحد" : "لدي حساب — تسجيل الدخول"}
        </button>
      </form>
    </div>
    </>
  );
};

export default Auth;
