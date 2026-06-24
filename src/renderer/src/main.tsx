import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Verso: #root element is missing from index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
