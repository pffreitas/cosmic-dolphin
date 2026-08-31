import { HomeBriefPrototype } from "@/components/home-brief-prototype/HomeBriefPrototype";

// PROTOTYPE: throwaway UI exploration for Smart Home Brief.
// Three variants of the dashboard home brief, switchable via ?variant=, on a
// route close to the future dashboard implementation.
export default async function SmartHomeBriefPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const params = await searchParams;
  const variant = params.variant === "B" || params.variant === "C"
    ? params.variant
    : "A";

  return <HomeBriefPrototype initialVariant={variant} />;
}
