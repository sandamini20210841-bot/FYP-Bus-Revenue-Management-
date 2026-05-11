import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store, type RootState, type AppDispatch } from "./store";
import MainLayout from "./layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import RoutesPage from "./pages/RoutesPage";
import DiscrepanciesPage from "./pages/DiscrepanciesPage";
import ReportsPage from "./pages/ReportsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SummaryPage from "./pages/SummaryPage";
import TimetablePage from "./pages/TimetablePage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import BusesPage from "./pages/BusesPage";
import { type ModuleName, useAccessPermissions } from "./hooks/useAccessPermissions";
import { setTheme } from "./store/slices/uiSlice";

const RoleHomeRedirect = () => {
  const role = (useSelector((state: RootState) => state.auth.user?.role) || "")
    .toString()
    .toLowerCase();

  if (role === "time_keeper") {
    return <Navigate to="/routes" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const RequireModuleAccess = ({
  moduleName,
  children,
}: {
  moduleName: ModuleName;
  children: JSX.Element;
}) => {
  const { isLoading, canView } = useAccessPermissions();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading access settings...
      </div>
    );
  }

  if (!canView(moduleName)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied for this module.
      </div>
    );
  }

  return children;
};

const ThemeManager = ({ children }: { children: JSX.Element }) => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useSelector((state: RootState) => state.ui.theme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      dispatch(setTheme(stored));
    }
  }, [dispatch]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  return children;
};

function App() {
  return (
    <Provider store={store}>
      <ThemeManager>
        <Router>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Main Routes (protected) */}
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RoleHomeRedirect />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="dashboard">
                      <DashboardPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/discrepancies"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="discrepancies">
                      <DiscrepanciesPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/routes"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="routes">
                      <RoutesPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="reports">
                      <ReportsPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/buses"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="buses">
                      <BusesPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/summary"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="summary">
                      <SummaryPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/timetable"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="timetable">
                      <TimetablePage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/transactions"
              element={
                <RequireAuth>
                  <MainLayout>
                    <div>Transactions Page</div>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="users">
                      <UsersPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <RequireAuth>
                  <MainLayout>
                    <RequireModuleAccess moduleName="audit_logs">
                      <AuditLogsPage />
                    </RequireModuleAccess>
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <MainLayout>
                    <SettingsPage />
                  </MainLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </RequireAuth>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ThemeManager>
    </Provider>
  );
}

export default App;
