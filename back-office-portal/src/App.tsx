import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import MainLayout from "./layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import RoutesPage from "./pages/RoutesPage";
import DiscrepanciesPage from "./pages/DiscrepanciesPage";

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          {/* Auth Routes - TODO: Create these pages */}
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/register" element={<div>Register Page</div>} />

          {/* Main Routes */}
          <Route
            path="/"
            element={
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            }
          />
          <Route
            path="/discrepancies"
            element={
              <MainLayout>
                <DiscrepanciesPage />
              </MainLayout>
            }
          />
          <Route
            path="/routes"
            element={
              <MainLayout>
                <RoutesPage />
              </MainLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <MainLayout>
                <div>Reports Page</div>
              </MainLayout>
            }
          />
          <Route
            path="/transactions"
            element={
              <MainLayout>
                <div>Transactions Page</div>
              </MainLayout>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <MainLayout>
                <div>Audit Logs Page</div>
              </MainLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <MainLayout>
                <div>Settings Page</div>
              </MainLayout>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
