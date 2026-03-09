import { useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import CadastroSolicitacoes from './components/CadastroSolicitacoes'
import Configuracoes from './components/Configuracoes'
import GestaoAihs from './components/GestaoAihs'
import UniversidadeNexusModal from './components/UniversidadeNexus/UniversidadeNexusModal'

export default function Eletivas() {
  const [abaAtiva, setAbaAtiva] = useState('cadastro')
  const [showUniversidade, setShowUniversidade] = useState(false)

  const iconeEletivas = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">

      <Header
        title="AIHs Cirurgias Eletivas"
        icon={iconeEletivas}
        badge="Módulo Operacional"
        description="Registro, aprovação e monitoramento de AIHs"
      />

      {/* Ajustado padding e gap para telas menores (px-4 sm:px-8 e gap-4 sm:gap-8) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 pt-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 pb-1">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setAbaAtiva('cadastro')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${abaAtiva === 'cadastro' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Cadastro de Solicitações
              {abaAtiva === 'cadastro' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-sky-500 rounded-t-full"></span>}
            </button>

            <button
              onClick={() => setAbaAtiva('gestao')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${abaAtiva === 'gestao' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Gestão de AIHs
              {abaAtiva === 'gestao' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-sky-500 rounded-t-full"></span>}
            </button>

            <button
              onClick={() => setAbaAtiva('configuracoes')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${abaAtiva === 'configuracoes' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Configurações do Módulo
              {abaAtiva === 'configuracoes' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-sky-500 rounded-t-full"></span>}
            </button>
          </div>
          <button onClick={() => setShowUniversidade(true)} className="flex items-center justify-center gap-2 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold py-2 px-4 rounded-xl transition-all shadow-sm group mb-2 sm:mb-1 w-full sm:w-auto">
            <svg className="w-5 h-5 text-sky-500 group-hover:rotate-12 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="text-xs sm:text-sm">Universidade Nexus</span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
        {abaAtiva === 'cadastro' && <CadastroSolicitacoes />}
        {abaAtiva === 'gestao' && <GestaoAihs />}
        {abaAtiva === 'configuracoes' && <Configuracoes />}
      </main>

      <Footer />

      {showUniversidade && <UniversidadeNexusModal onClose={() => setShowUniversidade(false)} />}
    </div>
  )
}