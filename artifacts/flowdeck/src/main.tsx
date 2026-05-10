import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize dark mode before first paint
const theme = localStorage.getItem("theme");
if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
