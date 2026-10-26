import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { initCsrf } from "./lib/api";
import { loadConfig } from "./lib/config";
import App from "./App";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

// Lấy CSRF cookie + cấu hình CLB trước khi render để giao diện đúng ngay từ đầu
Promise.all([initCsrf(), loadConfig()]).catch(() => {}).finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
});
