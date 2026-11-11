import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CompareProvider } from './compare'
import { ProfileProvider } from './profile'
import './styles.css'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } } })
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={qc}><BrowserRouter><ProfileProvider><CompareProvider><App /></CompareProvider></ProfileProvider></BrowserRouter></QueryClientProvider></StrictMode>,
)
