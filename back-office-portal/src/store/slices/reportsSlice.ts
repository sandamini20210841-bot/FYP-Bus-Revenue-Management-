import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Report {
  id: string;
  type: 'daily' | 'all-time' | 'ticket-sales';
  dateFrom: string;
  dateTo: string;
  data: any;
  createdAt: string;
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  routeNumber?: string;
  busNumber?: string;
  transactionType?: string;
}

interface ReportsState {
  templates: string[];
  selectedTemplate: 'daily' | 'all-time' | 'ticket-sales';
  filters: ReportFilters;
  generatedReport: Report | null;
  exportFormat: 'csv';
  loading: boolean;
  error: string | null;
}

const initialState: ReportsState = {
  templates: ['daily', 'all-time', 'ticket-sales'],
  selectedTemplate: 'daily',
  filters: {
    dateFrom: '',
    dateTo: '',
  },
  generatedReport: null,
  exportFormat: 'csv',
  loading: false,
  error: null,
};

export const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setSelectedTemplate: (state, action: PayloadAction<'daily' | 'all-time' | 'ticket-sales'>) => {
      state.selectedTemplate = action.payload;
    },
    setReportFilters: (state, action: PayloadAction<Partial<ReportFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setGeneratedReport: (state, action: PayloadAction<Report | null>) => {
      state.generatedReport = action.payload;
    },
    setReportsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setReportsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setSelectedTemplate,
  setReportFilters,
  setGeneratedReport,
  setReportsLoading,
  setReportsError,
} = reportsSlice.actions;
export default reportsSlice.reducer;
