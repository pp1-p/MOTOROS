"use client";

import { useState, type FormEvent } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BrandLogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    setMessage(null);
    const response = await fetch("/api/uploads/branding-logo", {
      method: "POST",
      body: new FormData(form),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setMessage(result?.message ?? "The logo could not be updated.");
    setUploading(false);
    if (response?.ok) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-5">
      <h2 className="font-extrabold">Brand logo</h2>
      <p className="mt-1 text-xs text-foreground/45">
        Validated raster images only. SVG is not accepted without sanitisation.
      </p>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Current dealership logo"
          className="mt-4 h-20 max-w-64 rounded-xl border bg-white object-contain p-3"
        />
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-[11px] font-extrabold">
          New logo
          <Input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="mt-1.5"
          />
        </label>
        <Button type="submit" disabled={uploading}>
          {uploading ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
          Upload logo
        </Button>
      </div>
      {message ? (
        <p role="status" className="mt-3 text-xs font-semibold text-foreground/60">
          {message}
        </p>
      ) : null}
    </form>
  );
}
