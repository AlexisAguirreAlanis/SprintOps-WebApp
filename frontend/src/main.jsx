import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyStoredAppearance } from './domain/appearance'
import { applyLocale, loadLocale } from './domain/locale'
import './index.css' // We might keep this or remove it, but let's keep it for tailwind directives if preferred

applyStoredAppearance()
applyLocale(loadLocale())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
