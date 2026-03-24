import CheckoutClient from "@/app/checkout/CheckoutClient";

function normalizePlan(value: string | string[] | undefined): "dex" | "full" {
  const planValue = Array.isArray(value) ? value[0] : value;
  return planValue === "full" ? "full" : "dex";
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const params = await searchParams;
  const plan = normalizePlan(params.plan);
  return <CheckoutClient plan={plan} />;
}
