export type ClubConfig = {
  name: string; logo: string; primaryColor: string; radius: string;
  texts: Record<string, string>;
};

export async function loadConfig(): Promise<ClubConfig> {
  const cfg: ClubConfig = await (await fetch("/club.config.json")).json();
  const root = document.documentElement;
  root.style.setProperty("--primary", cfg.primaryColor);
  root.style.setProperty("--radius", cfg.radius);
  document.title = cfg.name;
  return cfg;
}