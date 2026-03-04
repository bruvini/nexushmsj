import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PainelKanban from './components/PainelKanban'

export default function KanbanAltas() {
  const iconeKanban = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Header 
        title="Gestão de Altas e Fluxo (NIR)"
        icon={iconeKanban}
        badge="Módulo Assistencial"
        description="Monitoramento de tempo de permanência e desospitalização"
      />

      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto relative">
        <PainelKanban />
      </main>

      <Footer />
    </div>
  )
}