import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./app/ThemeContext.jsx";
import App from "./app/App.jsx";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
