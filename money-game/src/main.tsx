import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { GameProvider } from './store'

createRoot(document.getElementById('root')!).render(
  <StrictMode><GameProvider><App /></GameProvider></StrictMode>,
)
