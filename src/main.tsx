
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

  // Fade the splash out once the app is on screen (and it has been up at least ~0.7s)
  const splash = document.getElementById("splash");
  if (splash) {
    setTimeout(() => {
      splash.classList.add("hide");
      setTimeout(() => splash.remove(), 400);
    }, Math.max(0, 700 - performance.now()));
  }
