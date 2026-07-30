import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './app/App'
import './index.css'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#7dcea0' },
    secondary: { main: '#e67e22' },
    background: { default: '#0f0f0f', paper: '#1a1a1a' },
    text: { primary: '#f4f1ea', secondary: 'rgba(244,241,234,0.65)' },
    divider: 'rgba(255,255,255,0.1)',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    h1: { fontFamily: '"Fraunces", Georgia, serif' },
    h2: { fontFamily: '"Fraunces", Georgia, serif' },
    h3: { fontFamily: '"Fraunces", Georgia, serif' },
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
