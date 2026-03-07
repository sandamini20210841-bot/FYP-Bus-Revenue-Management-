import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Transaction {
  id: string;
  userId: string;
  ticketId: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  status: string;
}

interface TransactionsState {
  list: Transaction[];
  pagination: { page: number; limit: number; total: number };
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  list: [],
  pagination: { page: 1, limit: 10, total: 0 },
  loading: false,
  error: null,
};

export const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.list = action.payload;
    },
    setPagination: (
      state,
      action: PayloadAction<{ page: number; limit: number; total: number }>
    ) => {
      state.pagination = action.payload;
    },
    setTransactionsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setTransactionsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setTransactions, setPagination, setTransactionsLoading, setTransactionsError } =
  transactionsSlice.actions;
export default transactionsSlice.reducer;
