import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Ticket {
  id: string;
  routeId: string;
  amount: number;
  purchaseDate: string;
  status: string;
}

interface Transaction {
  id: string;
  ticketId: string;
  amount: number;
  date: string;
}

interface TicketsState {
  purchased: Ticket[];
  currentTicket: Ticket | null;
  transactionHistory: Transaction[];
  filters: {
    dateFrom: string;
    dateTo: string;
  };
  loading: boolean;
  error: string | null;
}

const initialState: TicketsState = {
  purchased: [],
  currentTicket: null,
  transactionHistory: [],
  filters: {
    dateFrom: '',
    dateTo: '',
  },
  loading: false,
  error: null,
};

export const ticketsSlice = createSlice({
  name: 'tickets',
  initialState,
  reducers: {
    setTickets: (state, action: PayloadAction<Ticket[]>) => {
      state.purchased = action.payload;
    },
    setCurrentTicket: (state, action: PayloadAction<Ticket | null>) => {
      state.currentTicket = action.payload;
    },
    setTransactionHistory: (state, action: PayloadAction<Transaction[]>) => {
      state.transactionHistory = action.payload;
    },
    setTicketsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setTicketsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setFilters: (
      state,
      action: PayloadAction<{ dateFrom: string; dateTo: string }>
    ) => {
      state.filters = action.payload;
    },
  },
});

export const {
  setTickets,
  setCurrentTicket,
  setTransactionHistory,
  setTicketsLoading,
  setTicketsError,
  setFilters,
} = ticketsSlice.actions;
export default ticketsSlice.reducer;
