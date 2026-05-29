import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hosts permitidos para cargar recursos internos del dev server desde un
  // origen distinto a localhost (p. ej. el túnel de Cloudflare que expone el
  // puerto 3000). Solo aplica en desarrollo.
  allowedDevOrigins: ["local.eduinpro.net"],
};

export default nextConfig;
