import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Eletivas from './modules/Eletivas/Eletivas'
import KanbanAltas from './modules/KanbanAltas/KanbanAltas' // <-- Novo import adicionado
import TelemonitoramentoAVC from './modules/TelemonitoramentoAVC/TelemonitoramentoAVC'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/eletivas" element={<Eletivas />} />
      <Route path="/kanban-altas" element={<KanbanAltas />} /> {/* <-- Nova rota adicionada */}
      <Route path="/telemonitoramento-avc" element={<TelemonitoramentoAVC />} />
    </Routes>
  )
}

export default App