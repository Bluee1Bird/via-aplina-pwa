import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import DayCard from './screens/DayCard'
import Settings from './screens/Settings'
import { requestPersistentStorage } from './lib/storage'

export default function App() {
  // Ask the browser to keep uploaded data through version updates / disuse.
  // Idempotent; once granted it sticks, so firing on each launch is harmless.
  useEffect(() => { void requestPersistentStorage() }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stage/:stageId" element={<DayCard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  )
}
