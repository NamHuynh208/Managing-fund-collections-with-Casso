export type ClubConfig = {
  name: string;
  shortName?: string;
  logo?: string;
  primaryColor?: string;
  texts?: Record<string, string>;
};

const FALLBACK: ClubConfig = { name: "Quỹ CLB" };

let cfg: ClubConfig = FALLBACK;

export function getConfig(): ClubConfig {
  return cfg;
}

export async function loadConfig(): Promise<ClubConfig> {
  try {
    const res = await fetch("/clubconfig.json");
    if (res.ok) {
      cfg = { ...FALLBACK, ...(await res.json()) };
    }
  } catch {
    // thiếu file thì dùng mặc định, không chặn ứng dụng
  }
  const root = document.documentElement;
  if (cfg.primaryColor) {
    root.style.setProperty("--cfg-primary", cfg.primaryColor);
    root.setAttribute("data-brand", "custom");
  }
  document.title = cfg.name;
  return cfg;
}
