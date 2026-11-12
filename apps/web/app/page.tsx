import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { createClient } from "@/utils/supabase/server";
import "@/components/marketing/landing-page.css";

export const metadata: Metadata = {
  title: "Cosmic Dolphin · Actually read what you save",
  description:
    "Save any article, video or post. Cosmic Dolphin gives you the key ideas in a short, sourced brief, and brings the best of your saves back every morning.",
};

export default async function Index() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/my/dashboard");
  return <LandingPage />;
}
