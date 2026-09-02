import type { Preview } from "@storybook/react-vite";
// The real file, not a copy. Every story reads the same CSS the apps import.
import "../tokens.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
  },
};

export default preview;
