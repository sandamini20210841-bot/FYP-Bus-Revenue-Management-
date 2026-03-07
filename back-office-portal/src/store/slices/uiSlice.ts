import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  selectedLanguage: 'en' | 'ta' | 'si';
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

const initialState: UIState = {
  selectedLanguage: 'en',
  theme: 'light',
  sidebarOpen: true,
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
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { setLanguage, setTheme, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
