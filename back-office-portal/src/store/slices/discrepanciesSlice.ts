import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Discrepancy {
  id: string;
  routeNumber: string;
  busNumber: string;
  transactionDate: string;
  expectedRevenue: number;
  actualRevenue: number;
  lossAmount: number;
  status: 'pending' | 'investigating' | 'resolved';
}

interface DiscrepancyFilters {
  status: string[];
  routeNumber: string[];
  busNumber: string[];
  dateFrom: string;
  dateTo: string;
}

interface DiscrepanciesState {
  list: Discrepancy[];
  currentRecord: Discrepancy | null;
  filters: DiscrepancyFilters;
  pagination: { page: number; limit: number; total: number };
  loading: boolean;
  error: string | null;
}

const initialState: DiscrepanciesState = {
  list: [],
  currentRecord: null,
  filters: {
    status: [],
    routeNumber: [],
    busNumber: [],
    dateFrom: '',
    dateTo: '',
  },
  pagination: { page: 1, limit: 10, total: 0 },
  loading: false,
  error: null,
};

export const discrepanciesSlice = createSlice({
  name: 'discrepancies',
  initialState,
  reducers: {
    setDiscrepancies: (state, action: PayloadAction<Discrepancy[]>) => {
      state.list = action.payload;
    },
    setCurrentRecord: (state, action: PayloadAction<Discrepancy | null>) => {
      state.currentRecord = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<DiscrepancyFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPagination: (
      state,
      action: PayloadAction<{ page: number; limit: number; total: number }>
    ) => {
      state.pagination = action.payload;
    },
    setDiscrepanciesLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setDiscrepanciesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setDiscrepancies,
  setCurrentRecord,
  setFilters,
  setPagination,
  setDiscrepanciesLoading,
  setDiscrepanciesError,
} = discrepanciesSlice.actions;
export default discrepanciesSlice.reducer;
