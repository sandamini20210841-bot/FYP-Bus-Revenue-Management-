import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DashboardMetrics {
  totalRevenue: number;
  totalTransactions: number;
  revenueLoss: number;
  totalDiscrepancies: number;
}

interface ChartData {
  name: string;
  value: number;
}

interface DashboardState {
  metrics: DashboardMetrics | null;
  period: 'today' | 'week' | 'month' | 'all-time';
  revenueChart: ChartData[];
  transactionChart: ChartData[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  metrics: null,
  period: 'all-time',
  revenueChart: [],
  transactionChart: [],
  loading: false,
  error: null,
};

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setMetrics: (state, action: PayloadAction<DashboardMetrics>) => {
      state.metrics = action.payload;
    },
    setPeriod: (state, action: PayloadAction<'today' | 'week' | 'month' | 'all-time'>) => {
      state.period = action.payload;
    },
    setRevenueChart: (state, action: PayloadAction<ChartData[]>) => {
      state.revenueChart = action.payload;
    },
    setTransactionChart: (state, action: PayloadAction<ChartData[]>) => {
      state.transactionChart = action.payload;
    },
    setDashboardLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setDashboardError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setMetrics,
  setPeriod,
  setRevenueChart,
  setTransactionChart,
  setDashboardLoading,
  setDashboardError,
} = dashboardSlice.actions;
export default dashboardSlice.reducer;
