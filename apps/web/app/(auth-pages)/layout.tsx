/**
 * Auth — docs/design-system/pages.md § Auth.
 *
 * **A single centred column at 400px on `--cd-bg-subtle`.** What was here: a
 * `fixed inset-0 z-50 bg-white` overlay splitting the viewport in half, with a
 * hand-rolled slate gradient and a raw translucent grid pattern filling the
 * right side. Two problems, beyond the raw colours: `bg-white` meant dark
 * mode was a white page, and `fixed inset-0 z-50` meant the auth pages painted
 * over the app frame rather than sitting inside it.
 *
 * This sits in the flow, so the header capsule above it stays reachable and
 * the sign-in page is a page rather than a takeover.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 flex min-h-[70vh] justify-center bg-bg-subtle px-4 py-16 md:-mx-6 md:px-6">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
