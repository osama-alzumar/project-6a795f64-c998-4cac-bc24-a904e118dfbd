import { supabase } from "@/integrations/supabase/client";

export const WHATSAPP_NUMBER = "966507074560";
export const CALL_NUMBER = "0559170464";

export type OrderLine = { id: string; name: string; price: number; qty: number };

export const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);

export const buildOrderText = (
  items: OrderLine[],
  total: number,
  opts: { orderNo?: number | null; branchName?: string | null } = {}
) => {
  const lines = items.map((i) => `• ${i.name} ×${i.qty} — ${(i.price * i.qty).toFixed(2)} ر.س`);
  return [
    "طلب جديد من منيو جوليث:",
    opts.orderNo ? `رقم الطلب: #${opts.orderNo}` : "",
    opts.branchName ? `الفرع: ${opts.branchName}` : "",
    "",
    ...lines,
    "",
    `الإجمالي: ${total.toFixed(2)} ر.س`,
  ]
    .filter((l) => l !== "" || true)
    .join("\n");
};

export const whatsappUrl = (text: string) =>
  isMobileDevice()
    ? `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(text)}`;

export const openWhatsApp = (text: string) => {
  const url = whatsappUrl(text);
  if (isMobileDevice()) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
};

/** يحفظ الطلب في قاعدة البيانات ويعيد رقم الطلب (أو null عند الفشل) */
export const saveOrder = async (params: {
  items: OrderLine[];
  total: number;
  branchId?: string | null;
  branchName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}) => {
  const { data, error } = await supabase.rpc("place_order", {
    _items: params.items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    _total: params.total,
    _branch_id: params.branchId ?? null,
    _branch_name: params.branchName ?? null,
    _customer_name: params.customerName ?? null,
    _customer_phone: params.customerPhone ?? null,
  });
  if (error) {
    console.error("saveOrder failed:", error.message);
    return null;
  }
  return (data as number | null) ?? null;
};
