import { useState } from "react";
import { Button } from "./ui";

export default function CopyButton({
  text,
  label = "Sao chép",
  copiedLabel = "Đã sao chép",
  variant = "outline",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "outline" | "ghost";
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // trình duyệt cũ / không HTTPS: thử cách dự phòng
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }

  return (
    <Button type="button" variant={variant} onClick={copy} className="!py-1 !px-2.5 !text-xs">
      {done ? `✓ ${copiedLabel}` : label}
    </Button>
  );
}
