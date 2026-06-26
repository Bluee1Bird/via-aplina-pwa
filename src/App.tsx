import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import DayCard from './screens/DayCard'
import Settings from './screens/Settings'

export default function App() {
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
