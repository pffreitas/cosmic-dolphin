import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/server";
import { User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { User } from "@supabase/auth-js";

type ProfileDropDownProps = {
  user: User | null;
};

const ProfileDropDown: React.FC<ProfileDropDownProps> = ({ user }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={"sm"}>
          <UserIcon size={16} className={"text-muted-foreground"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="start">
        <div className="rounded-lg bg-white shadow-lg p-4 border border-teal-200 flex flex-col gap-2">
          <Link href={"/my/profile"}>{user?.email}</Link>
          <form action={signOutAction}>
            <Button type="submit" size="sm" variant={"outline"}>
              Sign out
            </Button>
          </form>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <div className="flex items-center gap-4">
      <ProfileDropDown user={user} />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
