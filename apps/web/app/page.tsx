import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";

/**
 * `/` — the signed-out door, and a redirect for everybody else.
 *
 * What was here: `<Hero />`, a component whose entire body was two empty divs
 * and a gradient rule, above an `<h1>Public Main</h1>`. D18 deletes `hero.tsx`
 * along with the rest of the pre-revamp chrome, so this page needed something
 * real to say instead.
 *
 * A signed-in reader never sees it. Home is the product; a marketing page in
 * front of it for somebody who already has an account is a page they have to
 * click through every time they type the bare domain.
 */
export default async function Index() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/my/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-[52ch] flex-col items-start gap-6 py-20">
      <h1 className="font-serif text-[34px] font-semibold leading-[1.2] tracking-[-.02em] text-fg">
        Save a link. Get it back when it matters.
      </h1>
      <p className="font-sans text-[15px] leading-[1.6] text-fg-secondary">
        Cosmic Dolphin reads what you save, summarises it, files it, and puts it
        in front of you again at the point it is useful. Everything it writes
        names the source it came from.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" asChild>
          <Link href="/sign-up">Create an account</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
