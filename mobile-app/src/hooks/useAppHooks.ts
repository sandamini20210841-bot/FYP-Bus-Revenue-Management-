import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <TSelected,>(selector: (state: RootState) => TSelected): TSelected =>
  useSelector<RootState, TSelected>(selector);
