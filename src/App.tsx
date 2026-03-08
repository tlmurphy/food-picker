import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Game from './pages/Game'
import Join from './pages/Join'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Join />} />
        <Route path="/:sessionId" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
