import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0f1512] p-6 text-white">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <ShieldAlert className="mx-auto size-9 text-[#d7ad69]" aria-hidden />
        <h1 className="mt-5 font-display text-4xl">Access is restricted.</h1>
        <p className="mt-4 text-sm leading-6 text-white/60">
          Your account is signed in, but its dealership role does not permit this
          area. Ask an owner to review your role if you believe this is incorrect.
        </p>
        <Button asChild className="mt-7 bg-[#d7ad69] text-[#171814]">
          <Link href="/">Return to dealership website</Link>
        </Button>
      </div>
    </main>
  );
}
