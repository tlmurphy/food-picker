import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

// biome-ignore lint/style/noNonNullAssertion: root element is always present in index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" theme="dark" richColors />
  </StrictMode>,
)
