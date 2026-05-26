"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretDown, Check, Plus } from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";

import { cn } from "@/lib/utils";
import { organization } from "@/lib/auth/client";

type Props = {
  currentOrg: { id: string; name: string; slug: string };
  memberships: Array<{ id: string; name: string; slug: string }>;
};

export function OrgSwitcher({ currentOrg, memberships }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSelect(target: { id: string; slug: string }) {
    setOpen(false);
    if (target.id === currentOrg.id) return;
    startTransition(async () => {
      await organization.setActive({ organizationId: target.id });
      router.push(`/o/${target.slug}`);
      router.refresh();
    });
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        className={cn(
          "inline-flex items-center gap-2 rounded-none border border-transparent px-2 py-1 text-sm",
          "hover:bg-muted focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
          pending && "opacity-50",
        )}
        disabled={pending}
      >
        <span className="font-medium">{currentOrg.name}</span>
        <CaretDown size={12} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 min-w-56 border border-border bg-popover text-popover-foreground shadow-md",
            "rounded-none p-1",
          )}
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">
            Tus organizaciones
          </DropdownMenu.Label>
          {memberships.map((m) => {
            const active = m.id === currentOrg.id;
            return (
              <DropdownMenu.Item
                key={m.id}
                onSelect={() => handleSelect(m)}
                className={cn(
                  "flex cursor-default items-center justify-between gap-2 px-2 py-1.5 text-sm outline-none",
                  "data-[highlighted]:bg-muted",
                )}
              >
                <span className="truncate">{m.name}</span>
                {active ? <Check size={14} weight="bold" /> : null}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link
              href="/onboarding/new-org"
              className="flex items-center gap-2 px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
            >
              <Plus size={14} weight="bold" />
              Crear nueva organización
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
