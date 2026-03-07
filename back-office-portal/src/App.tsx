import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          {/* Auth Routes - TODO: Create these pages */}
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/register" element={<div>Register Page</div>} />

          {/* Main Routes - TODO: Create these pages */}
          <Route path="/" element={<div>Dashboard Page</div>} />
          <Route
            path="/discrepancies"
            element={<div>Discrepancies Page</div>}
          />
          <Route path="/routes" element={<div>Routes Page</div>} />
          <Route path="/reports" element={<div>Reports Page</div>} />
          <Route path="/transactions" element={<div>Transactions Page</div>} />
          <Route path="/audit-logs" element={<div>Audit Logs Page</div>} />
          <Route path="/settings" element={<div>Settings Page</div>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
