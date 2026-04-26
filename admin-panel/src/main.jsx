import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Support ngrok deployment: when built with VITE_BASE_PATH=/admin/,
// React Router uses /admin as the basename so all routes are prefixed correctly.
// Falls back to '/' for local dev (unchanged behaviour).
const rawBase = import.meta.env.VITE_BASE_PATH || '/'
const basename = rawBase.replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
