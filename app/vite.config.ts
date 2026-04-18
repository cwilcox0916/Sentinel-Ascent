import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon-32.png",
        "icon-128.png",
        "icon-256.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Sentinel Ascent",
        short_name: "Sentinel",
        description: "Radial survival-defense incremental game",
        theme_color: "#07090f",
        background_color: "#07090f",
        display: "fullscreen",
        orientation: "any",
        icons: [
          { src: "/icon-128.png", sizes: "128x128", type: "image/png" },
          { src: "/icon-256.png", sizes: "256x256", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: false,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "zustand"],
  },
});
