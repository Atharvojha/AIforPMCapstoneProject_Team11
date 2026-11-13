import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetClientLog } from '../lib/clientLog';
if (!(URL as any).createObjectURL) (URL as any).createObjectURL = () => 'blob:test';
if (!(URL as any).revokeObjectURL) (URL as any).revokeObjectURL = () => {};
afterEach(() => { cleanup(); resetClientLog(); try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ } });
