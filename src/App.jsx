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
      <Route path="/indicadores" element={<div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 relative"><div className="w-16 h-16 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mb-4"></div><h2 className="text-xl font-bold text-slate-700">Indicadores & Relatórios</h2><p className="text-slate-500 text-sm mt-2">Módulo em construção pelos engenheiros de dados.</p><a href="/" className="mt-6 text-sky-600 font-semibold hover:underline">Voltar para o Início</a></div>} />
    </Routes>
  )
}

export default App