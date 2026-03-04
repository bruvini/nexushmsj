import { useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PainelKanban from './components/PainelKanban'
import ImportacaoCenso from './components/ImportacaoCenso'

export default function KanbanAltas() {
  const [abaAtiva, setAbaAtiva] = useState('painel')

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

      <div className="bg-nexus-card border-b border-nexus-border px-4 sm:px-8 pt-4">
        <div className="flex gap-4 sm:gap-8 overflow-x-auto custom-scrollbar pb-1">
          <button 
            onClick={() => setAbaAtiva('painel')}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
              abaAtiva === 'painel' ? 'text-nexus-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Painel de Monitoramento
            {abaAtiva === 'painel' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-nexus-primary rounded-t-full"></span>}
          </button>
          
          <button 
            onClick={() => setAbaAtiva('importacao')}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
              abaAtiva === 'importacao' ? 'text-nexus-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Sincronizar Censo (Importação)
            {abaAtiva === 'importacao' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-nexus-primary rounded-t-full"></span>}
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
        {abaAtiva === 'painel' && <PainelKanban />}
        {abaAtiva === 'importacao' && <ImportacaoCenso onImportSuccess={() => setAbaAtiva('painel')} />}
      </main>

      <Footer />
    </div>
  )
}