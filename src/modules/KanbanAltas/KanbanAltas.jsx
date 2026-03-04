// src/modules/KanbanAltas/KanbanAltas.jsx
import Header from '../../components/Header'
import Footer from '../../components/Footer'

export default function KanbanAltas() {
  const iconeKanban = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Header 
        title="Kanban de Altas"
        icon={iconeKanban}
        badge="Módulo Assistencial"
        description="Gestão visual do fluxo de altas e desospitalização"
      />

      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex items-center justify-center">
          <p className="text-slate-500 font-medium">O quadro Kanban será construído aqui.</p>
        </div>
      </main>

      <Footer />
    </div>
  )
}