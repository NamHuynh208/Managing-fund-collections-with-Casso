export const vnd = (n: number) => (n ?? 0).toLocaleString("vi-VN") + " đ";
export const vndShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tỷ";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n ?? 0);
};
export const dt = (s: string) => new Date(s).toLocaleString("vi-VN");
export const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "");
export const month = (s: string) => {
  const [y, m] = s.split("-");
  return `T${Number(m)}/${y.slice(2)}`;
};
