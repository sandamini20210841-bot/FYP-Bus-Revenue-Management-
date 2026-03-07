import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  details: any;
}

interface AuditLogsState {
  logs: AuditLog[];
  pagination: { page: number; limit: number; total: number };
  loading: boolean;
  error: string | null;
}

const initialState: AuditLogsState = {
  logs: [],
  pagination: { page: 1, limit: 10, total: 0 },
  loading: false,
  error: null,
};

export const auditLogsSlice = createSlice({
  name: 'auditLogs',
  initialState,
  reducers: {
    setAuditLogs: (state, action: PayloadAction<AuditLog[]>) => {
      state.logs = action.payload;
    },
    setPagination: (
      state,
      action: PayloadAction<{ page: number; limit: number; total: number }>
    ) => {
      state.pagination = action.payload;
    },
    setAuditLogsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAuditLogsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setAuditLogs, setPagination, setAuditLogsLoading, setAuditLogsError } =
  auditLogsSlice.actions;
export default auditLogsSlice.reducer;
