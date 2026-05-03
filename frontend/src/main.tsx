import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = document.getElementById('root')!

if (!PUBLISHABLE_KEY) {
  createRoot(root).render(
    <StrictMode>
      <p style={{ padding: '1rem', fontFamily: 'system-ui', maxWidth: '40rem', margin: '2rem auto' }}>
        Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code>. Copy{' '}
        <code>frontend/.env.example</code> to <code>frontend/.env.local</code> and add your Clerk
        publishable key from the Clerk dashboard (API Keys).
      </p>
    </StrictMode>,
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
}
