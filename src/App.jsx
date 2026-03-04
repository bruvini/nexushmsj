import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Eletivas from './modules/Eletivas/Eletivas'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/eletivas" element={<Eletivas />} />
    </Routes>
  )
}

export default App