import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    proxy: {
      "/cosmos": {
        target: "http://127.0.0.1:1317",
        changeOrigin: true,
      },

      "/rpc": {
        target: "http://127.0.0.1:26657",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc/, ""),
      },
    },
  },
});
