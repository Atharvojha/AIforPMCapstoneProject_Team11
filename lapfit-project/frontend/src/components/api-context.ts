import { createContext, useContext } from 'react';
import type { ApiConfig } from '../lib/api';
export const ApiConfigContext = createContext<ApiConfig | null>(null);
export const useApiConfig = () => useContext(ApiConfigContext);
