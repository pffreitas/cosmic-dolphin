import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

function getApiBasePath(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

async function getProfile(accessToken: string) {
  try {
    const res = await fetch(`${getApiBasePath()}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user || !session) {
    return redirect("/sign-in");
  }

  const profile = await getProfile(session.access_token);

  const profileData = profile ?? {
    id: user.id,
    name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0],
    email: user.email,
    pictureUrl:
      user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div>
        <h1 className="font-bold text-2xl">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile information
        </p>
      </div>
      <ProfileForm profile={profileData} />
    </div>
  );
}
