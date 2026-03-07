import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Route {
  id: string;
  routeNumber: string;
  busNumber: string;
  createdBy: string;
  description: string;
  stops: string[];
}

interface RoutesState {
  list: Route[];
  currentRoute: Route | null;
  loading: boolean;
  error: string | null;
}

const initialState: RoutesState = {
  list: [],
  currentRoute: null,
  loading: false,
  error: null,
};

export const routesSlice = createSlice({
  name: 'routes',
  initialState,
  reducers: {
    setRoutes: (state, action: PayloadAction<Route[]>) => {
      state.list = action.payload;
    },
    setCurrentRoute: (state, action: PayloadAction<Route | null>) => {
      state.currentRoute = action.payload;
    },
    setRoutesLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setRoutesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setRoutes, setCurrentRoute, setRoutesLoading, setRoutesError } =
  routesSlice.actions;
export default routesSlice.reducer;
