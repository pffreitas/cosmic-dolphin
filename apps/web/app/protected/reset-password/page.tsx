import { resetPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { AuthField, AuthShell } from "@/app/(auth-pages)/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Set a new password.
 *
 * Lives outside `(auth-pages)` because it is reached with a session in hand —
 * the recovery link has already signed the user in — but it is the same form
 * surface, so it borrows the same shell rather than growing a fourth look.
 *
 * The message sits under **Confirm password**: `resetPasswordAction` reports
 * two things, "they do not match" and "the update failed", and both are about
 * the second field or about the pair.
 */
export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  const hasMessage =
    "error" in searchParams ||
    "success" in searchParams ||
    ("message" in searchParams && Boolean(searchParams.message));

  return (
    <div className="-mx-4 flex min-h-[70vh] justify-center bg-bg-subtle px-4 py-16 md:-mx-6 md:px-6">
      <div className="w-full max-w-[400px]">
        <AuthShell
          title="Set a new password"
          subtitle="Choose a password you have not used here before."
        >
          <form
            action={resetPasswordAction}
            className="flex flex-col gap-4"
          >
            <AuthField label="New password" htmlFor="reset-password">
              <Input
                id="reset-password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="New password"
                minLength={6}
                required
              />
            </AuthField>

            <AuthField
              label="Confirm password"
              htmlFor="reset-confirm-password"
              message={
                hasMessage ? (
                  <FormMessage
                    id="reset-confirm-message"
                    message={searchParams}
                  />
                ) : null
              }
            >
              <Input
                id="reset-confirm-password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm password"
                minLength={6}
                required
                aria-invalid={"error" in searchParams}
                aria-describedby={
                  "error" in searchParams ? "reset-confirm-message" : undefined
                }
              />
            </AuthField>

            <Button type="submit" variant="primary" className="w-full">
              Update password
            </Button>
          </form>
        </AuthShell>
      </div>
    </div>
  );
}
