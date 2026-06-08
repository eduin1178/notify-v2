import { requireSession } from "@/lib/auth/guards";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
