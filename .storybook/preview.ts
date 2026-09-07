import type { Preview } from "@storybook/react-vite";
// The real files, not copies. Every story reads the same CSS the apps import,
// in the same order — controls.css is written against the tokens and resolves
// to nothing without them.
import "../tokens.css";
import "../controls.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
  },
};

export default preview;
