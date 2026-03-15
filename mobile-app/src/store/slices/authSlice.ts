import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

let persistedUser: User | null = null;
let persistedToken: string | null = null;
let persistedRefreshToken: string | null = null;

if (typeof window !== 'undefined') {
  try {
    const rawUser = window.localStorage.getItem('authUser');
    if (rawUser) {
      persistedUser = JSON.parse(rawUser) as User;
    }
  } catch {
    persistedUser = null;
  }

  persistedToken = window.localStorage.getItem('authToken');
  persistedRefreshToken = window.localStorage.getItem('refreshToken');
}

const initialState: AuthState = {
  user: persistedUser,
  token: persistedToken,
  refreshToken: persistedRefreshToken,
  isAuthenticated: Boolean(persistedUser && persistedToken && persistedRefreshToken),
  loading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setToken: (state, action: PayloadAction<{ token: string; refreshToken: string }>) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAuthError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
});

export const { setUser, setToken, setAuthLoading, setAuthError, logout } = authSlice.actions;
export default authSlice.reducer;
