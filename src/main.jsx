import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const BOOT_SPLASH_ID = 'app-boot-splash'
let hasHiddenBootSplash = false

const hideBootSplash = () => {
  if (hasHiddenBootSplash) return
  const splash = document.getElementById(BOOT_SPLASH_ID)
  if (!splash) {
    hasHiddenBootSplash = true
    return
  }

  hasHiddenBootSplash = true
  splash.classList.add('is-hidden')
  window.setTimeout(() => {
    splash.remove()
  }, 280)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    hideBootSplash()
  })
})
window.setTimeout(hideBootSplash, 3600)
