import { useAuth } from "@/contexts/AuthContext";
import { Button, Notice } from "./ui/Signal";

/** The same revocation state is visible in Profile and the existing Settings route. */
export function SignOutControl() {
  const { user, signOut, signOutBusy, signOutError } = useAuth();
  if (!user) return <Notice message="You’re signed out." />;
  return signOutError ? (
    <Notice message={signOutError} error action="Retry" onAction={() => { void signOut(); }} />
  ) : (
    <Button title={signOutBusy ? "Finishing sign out…" : "Sign out"} busy={signOutBusy} onPress={() => { void signOut(); }} />
  );
}
