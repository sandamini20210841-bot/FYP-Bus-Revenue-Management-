import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  selectedLanguage: 'en' | 'ta' | 'si';
  theme: 'light' | 'dark';
  notifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>;
}

const initialState: UIState = {
  selectedLanguage: 'en',
  theme: 'light',
  notifications: [],
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<'en' | 'ta' | 'si'>) => {
      state.selectedLanguage = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    addNotification: (
      state,
      action: PayloadAction<{
        id: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
      }>
    ) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notif) => notif.id !== action.payload
      );
    },
  },
});

export const { setLanguage, setTheme, addNotification, removeNotification } =
  uiSlice.actions;
export default uiSlice.reducer;
