import { createRoot } from 'react-dom/client'
import App from './App'
import { installPlatformApi } from './web/install'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found.')

// The platform bridge must exist before React mounts (App calls api.getSettings()).
void installPlatformApi().then(() => {
  createRoot(rootEl).render(<App />)
})
