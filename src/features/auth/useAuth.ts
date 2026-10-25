import { useContext } from 'react';
import { AuthContext } from './authContext.ts';
import type { AuthContextValue } from './authContext.ts';

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
