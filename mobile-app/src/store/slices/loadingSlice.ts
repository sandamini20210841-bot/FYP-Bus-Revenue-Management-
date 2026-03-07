import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LoadingState {
  globalLoading: boolean;
  errors: Array<{
    id: string;
    message: string;
    code: string;
  }>;
}

const initialState: LoadingState = {
  globalLoading: false,
  errors: [],
};

export const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },
    addError: (
      state,
      action: PayloadAction<{
        id: string;
        message: string;
        code: string;
      }>
    ) => {
      state.errors.push(action.payload);
    },
    removeError: (state, action: PayloadAction<string>) => {
      state.errors = state.errors.filter((err) => err.id !== action.payload);
    },
    clearErrors: (state) => {
      state.errors = [];
    },
  },
});

export const { setGlobalLoading, addError, removeError, clearErrors } =
  loadingSlice.actions;
export default loadingSlice.reducer;
