import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store, type RootState } from "./store";
import { useSelector } from "react-redux";
import MainLayout from "./layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import RoutesPage from "./pages/RoutesPage";
import DiscrepanciesPage from "./pages/DiscrepanciesPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

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

function App() {
  return (
    <Provider store={store}>
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
                <MainLayout>
                  <DashboardPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/discrepancies"
            element={
              <RequireAuth>
                <MainLayout>
                  <DiscrepanciesPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/routes"
            element={
              <RequireAuth>
                <MainLayout>
                  <RoutesPage />
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <MainLayout>
                  <div>Reports Page</div>
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
            path="/audit-logs"
            element={
              <RequireAuth>
                <MainLayout>
                  <div>Audit Logs Page</div>
                </MainLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <MainLayout>
                  <div>Settings Page</div>
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
    </Provider>
  );
}

export default App;
