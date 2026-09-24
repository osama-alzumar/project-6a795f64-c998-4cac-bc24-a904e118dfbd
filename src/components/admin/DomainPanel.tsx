import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import DomainDiagnosis from "./DomainDiagnosis";

const DOMAIN = "julith.shop";
const EXPECTED_IP = "185.158.133.1";
const FALLBACK_URL = "https://voute-cafe-elegant.lovable.app";

type Check = { name: string; type: string; expected: string; observed: string[]; ok: boolean; error?: string };

async function dnsLookup(name: string, type: string) {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  const json = await res.json();
  const answers: string[] = (json.Answer ?? []).map((a: { data: string }) => a.data.replace(/"/g, ""));
  return { status: json.Status as number, answers };
}

export default function DomainPanel() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const run = useCallback(async (notify = true) => {
    setLoading(true);
    try {
      const targets = [DOMAIN, `www.${DOMAIN}`];
      const results: Check[] = await Promise.all(
        targets.map(async (name) => {
          try {
            const { answers } = await dnsLookup(name, "A");
            return { name, type: "A", expected: EXPECTED_IP, observed: answers, ok: answers.includes(EXPECTED_IP) };
          } catch {
            return { name, type: "A", expected: EXPECTED_IP, observed: [], ok: false, error: "تعذر الفحص" };
          }
        }),
      );
      const ns = await dnsLookup(DOMAIN, "NS").catch(() => ({ answers: [] as string[], status: -1 }));
      setNameservers(ns.answers);
      setChecks(results);
      setLastRun(new Date());
      const down = results.some((r) => !r.ok);
      if (down && notify) toast.error(`تنبيه: الموقع ${DOMAIN} لا يمكن الوصول إليه حاليًا`);
      else if (!down && notify) toast.success(`${DOMAIN} يعمل بشكل سليم`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(true);
    const id = setInterval(() => run(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [run]);

  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-5 ${allOk ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/10"}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {checks.length === 0 ? null : allOk ? (
              <CheckCircle2 className="w-7 h-7 text-primary" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-destructive" />
            )}
            <div>
              <h2 className="font-bold text-lg">{DOMAIN}</h2>
              <p className="text-sm text-muted-foreground">
                {checks.length === 0 ? "جارٍ الفحص..." : allOk ? "النطاق يعمل ويشير للموقع" : "تعذر الوصول إلى الموقع — السجلات مفقودة أو غير صحيحة"}
              </p>
              {lastRun && <p className="text-xs text-muted-foreground mt-1">آخر فحص: {lastRun.toLocaleTimeString("ar-SA")} — يُعاد تلقائيًا كل 5 دقائق</p>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => run(true)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} /> افحص الآن
          </Button>
        </div>
        {checks.length > 0 && !allOk && (
          <div className="mt-4 text-sm space-y-2">
            <p>• إذا اشتريت النطاق من Lovable: تأكد من رسالة تأكيد البريد من مسجّل النطاق، أو تواصل مع الدعم.</p>
            <p>• الرابط البديل يعمل: <a className="underline text-primary" href={FALLBACK_URL} target="_blank" rel="noreferrer">{FALLBACK_URL}</a></p>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-bold mb-3">سجلات DNS المطلوبة</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="text-right border-b">
                <th className="py-2">النوع</th><th>الاسم</th><th>القيمة المطلوبة</th><th>الموجود حاليًا</th><th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.name} className="border-b last:border-0">
                  <td className="py-2">{c.type}</td>
                  <td dir="ltr" className="text-right">{c.name === DOMAIN ? "@" : "www"}</td>
                  <td dir="ltr" className="text-right font-mono">{c.expected}</td>
                  <td dir="ltr" className="text-right font-mono">{c.error ?? (c.observed.join(", ") || "—")}</td>
                  <td>{c.ok ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <XCircle className="w-4 h-4 text-destructive" />}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2">TXT</td>
                <td dir="ltr" className="text-right">_lovable</td>
                <td className="text-muted-foreground">رمز التحقق من إعدادات النطاق</td>
                <td>—</td><td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          خوادم الأسماء: <span dir="ltr" className="font-mono">{nameservers.length ? nameservers.join(", ") : "لا توجد"}</span>
        </p>
      </div>

      <DomainDiagnosis
        defaultDomain={DOMAIN}
        autoReport={
          checks.length
            ? [
                `الخطأ في المتصفح: ${allOk ? "لا يوجد" : "DNS_PROBE_FINISHED_NXDOMAIN"}`,
                `خوادم الأسماء (NS): ${nameservers.join(", ") || "لا توجد"}`,
                ...checks.map((c) => `${c.type} ${c.name}: المطلوب ${c.expected} — الموجود ${c.observed.join(", ") || "لا يوجد"}`),
                "النطاق مشترى من Lovable ومضبوط كنطاق رئيسي",
              ].join("\n")
            : undefined
        }
      />
    </div>
  );
}
