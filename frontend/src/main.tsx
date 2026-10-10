import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import "./index.css";
import { api, initCsrf } from "./lib/api";
import { loadConfig } from "./lib/config";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Home from "./pages/Home";
import TreasurerGuard from "./components/TreasurerGuard";
import Periods from "./pages/treasurer/Periods";
import PeriodDetail from "./pages/treasurer/PeriodDetail";
import Transactions from "./pages/treasurer/Transactions";
const qc = new QueryClient();

function Guard({ children, treasurer = false }: { children: React.ReactNode; treasurer?: boolean }) {
  const { data: me, error, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => api<{ role: string }>("/me"), retry: false });
  if (isLoading) return null;
  if (error) return <Navigate to="/login" replace />;
  if (treasurer && me?.role !== "treasurer") return <p className="p-4">Bạn không có quyền vào trang này.</p>;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/verify" element={<Verify />} />
      <Route path="/" element={<Guard><Home /></Guard>} />
      {/* Trang thủ quỹ thêm ở đây, bọc <Guard treasurer> */}
      <Route element={<TreasurerGuard />}>
      <Route path="/thu-quy" element={<Periods />} />
      <Route path="/thu-quy/ky/:id" element={<PeriodDetail />} />
      <Route path="/thu-quy/giao-dich" element={<Transactions />} />
</Route>
    </Routes>
  );
}

Promise.all([initCsrf(), loadConfig()]).finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={qc}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  );
});