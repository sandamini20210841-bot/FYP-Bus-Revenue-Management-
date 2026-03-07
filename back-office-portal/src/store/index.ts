import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import dashboardReducer from './slices/dashboardSlice';
import discrepanciesReducer from './slices/discrepanciesSlice';
import routesReducer from './slices/routesSlice';
import reportsReducer from './slices/reportsSlice';
import transactionsReducer from './slices/transactionsSlice';
import auditLogsReducer from './slices/auditLogsSlice';
import alertsReducer from './slices/alertsSlice';
import uiReducer from './slices/uiSlice';
import loadingReducer from './slices/loadingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    discrepancies: discrepanciesReducer,
    routes: routesReducer,
    reports: reportsReducer,
    transactions: transactionsReducer,
    auditLogs: auditLogsReducer,
    alerts: alertsReducer,
    ui: uiReducer,
    loading: loadingReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
