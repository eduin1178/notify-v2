"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, SignOut, SpinnerGap } from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";

import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";

type Props = {
  user: {
    name: string;
    email: string;
    image: string | null | undefined;
  };
};

export function UserMenu({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/");
          router.refresh();
        },
      },
    });
    setPending(false);
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        className={cn(
          "inline-flex items-center gap-2 rounded-none border border-transparent px-2 py-1 text-sm",
          "hover:bg-muted focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
        )}
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center bg-muted text-[10px] font-medium"
        >
          {initials || "?"}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
        <CaretDown size={12} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={cn(
            "z-50 min-w-56 border border-border bg-popover text-popover-foreground shadow-md",
            "rounded-none p-1",
          )}
        >
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
            disabled={pending}
            className="flex cursor-default items-center gap-2 px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
          >
            {pending ? (
              <SpinnerGap size={14} weight="bold" className="animate-spin" />
            ) : (
              <SignOut size={14} weight="bold" />
            )}
            Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
