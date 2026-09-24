import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `أنت خبير DNS ونطاقات. المستخدم صاحب مقهى غير تقني.
الموقع مستضاف على Lovable: السجلات المطلوبة A للجذر @ و www إلى 185.158.133.1، وTXT باسم _lovable للتحقق.
إذا كان النطاق مشترى من Lovable فالسجلات تدار من Lovable (مسجّل Name.com) وغياب خوادم الأسماء يعني غالبًا تعليق النطاق لعدم تأكيد بريد المالك أو مشكلة لدى المسجّل.
اكتب بالعربية وبلغة بسيطة بهذا الشكل:
## التشخيص
(السبب الأرجح في جملتين)
## الأدلة
(نقاط قصيرة من البيانات المدخلة)
## خطوات الإصلاح
(خطوات مرقمة محددة)
## حل مؤقت
(إن وجد)
لا تخترع بيانات غير موجودة في المدخلات.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "يجب تسجيل الدخول" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "للمسؤول فقط" }, 403);

    const { domain, input } = await req.json();
    if (typeof input !== "string" || !input.trim() || input.length > 20000) return json({ error: "أدخل نتائج الفحص (حتى 20000 حرف)" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "مفتاح الذكاء الاصطناعي غير مهيأ" }, 500);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: `النطاق: ${String(domain ?? "").slice(0, 253)}\n\nنتائج الفحص والسجلات:\n${input}`,
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
      }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text();
      let msg = "تعذر إنشاء التشخيص";
      try { msg = JSON.parse(t)?.error?.message ?? msg; } catch { /* ignore */ }
      if (res.status === 429) msg = "ضغط كبير حاليًا، حاول بعد قليل";
      if (res.status === 402) msg = "رصيد الذكاء الاصطناعي غير كافٍ";
      return json({ error: msg }, res.status);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", completed = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          if (ev.type === "response.completed") completed = ev.response?.output_text ?? "";
          if (ev.type === "error" || ev.type === "response.failed") return json({ error: "فشل التشخيص" }, 502);
        } catch { /* partial */ }
      }
    }
    const out = text || completed;
    if (!out) return json({ error: "لم يُرجع النموذج تشخيصًا" }, 502);
    return json({ diagnosis: out });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "خطأ" }, 500);
  }
});
