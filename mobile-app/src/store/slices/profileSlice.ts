import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Profile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  profilePhotoUrl: string;
}

interface ProfileState {
  userData: Profile | null;
  preferences: {
    language: string;
    notifications: boolean;
  };
  lastUpdated: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  userData: null,
  preferences: {
    language: 'en',
    notifications: true,
  },
  lastUpdated: null,
  loading: false,
  error: null,
};

export const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<Profile>) => {
      state.userData = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setPreferences: (
      state,
      action: PayloadAction<{ language: string; notifications: boolean }>
    ) => {
      state.preferences = action.payload;
    },
    setProfileLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setProfileError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setProfile, setPreferences, setProfileLoading, setProfileError } =
  profileSlice.actions;
export default profileSlice.reducer;
