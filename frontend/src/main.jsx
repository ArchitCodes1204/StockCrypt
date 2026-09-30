import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Design system first so page styles can build on it: tokens/base, primitives, shell.
import './index.css'
import './components/ui/ui.css'
import './components/layout/layout.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
