"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { CopyButton } from "@/components/common/copy-button";

export function EditionUrl({ editionId }: { editionId: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${window.location.origin}${withBase(`/edition/${editionId}`)}`), [editionId]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="max-w-full truncate rounded-lg bg-muted px-2 py-1 font-mono text-xs" title={url}>{url || "…"}</code>
      {url && <CopyButton text={url} label="Copier l'adresse" />}
    </div>
  );
}
