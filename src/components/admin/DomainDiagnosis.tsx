import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

type Props = { defaultDomain: string; autoReport?: string };

export default function DomainDiagnosis({ defaultDomain, autoReport }: Props) {
  const [domain, setDomain] = useState(defaultDomain);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    if (!input.trim()) return toast.error("أدخل نتائج الفحص أولًا");
    setLoading(true);
    setError("");
    setResult("");
    const { data, error } = await supabase.functions.invoke("diagnose-domain", { body: { domain, input } });
    setLoading(false);
    let msg = data?.error as string | undefined;
    if (error && !msg) {
      try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* ignore */ }
      msg = msg ?? "تعذر إنشاء التشخيص";
    }
    if (msg) return setError(msg);
    setResult(data.diagnosis);
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-bold">تشخيص ذكي للنطاق</h3>
      </div>
      <p className="text-sm text-muted-foreground">الصق نتائج فحص النطاق أو سجلات DNS (من أي موقع فحص أو رسالة خطأ) وسيشرح لك السبب وخطوات الإصلاح.</p>
      <Input dir="ltr" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="julith.shop" />
      <Textarea
        dir="auto"
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="مثال: DNS_PROBE_FINISHED_NXDOMAIN — A @ لا يوجد — NS لا توجد..."
      />
      <div className="flex gap-2 flex-wrap">
        {autoReport && (
          <Button type="button" variant="outline" size="sm" onClick={() => setInput(autoReport)}>
            <ClipboardPaste className="w-4 h-4 ml-1" /> استخدم نتيجة الفحص الحالية
          </Button>
        )}
        <Button onClick={run} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Sparkles className="w-4 h-4 ml-1" />}
          {loading ? "جارٍ التحليل..." : "شخّص المشكلة"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-7 whitespace-pre-wrap">{result.replace(/^##\s*/gm, "▪ ")}</div>
      )}
    </div>
  );
}
