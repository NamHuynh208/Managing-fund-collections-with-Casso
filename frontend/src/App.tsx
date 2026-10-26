import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Register from "./pages/Register";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import { Guard } from "./components/Layout";
import TreasurerLayout from "./components/TreasurerLayout";
import Dashboard from "./pages/treasurer/Dashboard";
import Periods from "./pages/treasurer/Periods";
import PeriodDetail from "./pages/treasurer/PeriodDetail";
import Transactions from "./pages/treasurer/Transactions";
import History from "./pages/treasurer/History";
import Expenses from "./pages/treasurer/Expenses";
import Outflows from "./pages/treasurer/Outflows";
import Members from "./pages/treasurer/Members";
import Registrations from "./pages/treasurer/Registrations";
import Audit from "./pages/treasurer/Audit";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/verify" element={<Verify />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <Guard>
              <Home />
            </Guard>
          }
        />

        <Route element={<TreasurerLayout />}>
          <Route path="/thu-quy" element={<Dashboard />} />
          <Route path="/thu-quy/ky" element={<Periods />} />
          <Route path="/thu-quy/ky/:id" element={<PeriodDetail />} />
          <Route path="/thu-quy/giao-dich" element={<Transactions />} />
          <Route path="/thu-quy/lich-su" element={<History />} />
          <Route path="/thu-quy/chi-tieu" element={<Expenses />} />
          <Route path="/thu-quy/chuyen-di" element={<Outflows />} />
          <Route path="/thu-quy/thanh-vien" element={<Members />} />
          <Route path="/thu-quy/dang-ky" element={<Registrations />} />
          <Route path="/thu-quy/nhat-ky" element={<Audit />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
