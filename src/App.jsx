import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Eletivas from './modules/Eletivas/Eletivas'
import KanbanAltas from './modules/KanbanAltas/KanbanAltas' // <-- Novo import adicionado

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/eletivas" element={<Eletivas />} />
      <Route path="/kanban-altas" element={<KanbanAltas />} /> {/* <-- Nova rota adicionada */}
    </Routes>
  )
}

export default App