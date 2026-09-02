import { defineConfig } from "vite";

/**
 * Storybook's react-vite builder reads this. The only thing it's here for is
 * dependency pre-bundling: React ships CommonJS, and without an explicit
 * include Vite 8 served it raw, so the dev server died on
 * "does not provide an export named 'default'". The static build was fine,
 * which is what made it look like a config problem rather than a code one.
 */
export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
  },
});
