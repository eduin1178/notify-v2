import { requireSession } from "@/lib/auth/guards";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}
