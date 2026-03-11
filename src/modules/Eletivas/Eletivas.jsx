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
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 pt-4 pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
          {/* Menu de Abas */}
          <div className="flex-1 min-w-0">
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
          </div>

          {/* Botão de Ajuda */}
          <div className="shrink-0 mb-2 md:mb-0">
            <button onClick={() => setShowUniversidade(true)} className="flex items-center justify-center gap-2 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold py-2 px-4 rounded-xl transition-all shadow-sm group w-full sm:w-auto">
              <svg className="w-5 h-5 text-sky-500 group-hover:rotate-12 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs sm:text-sm">Ajuda para usar</span>
            </button>
          </div>
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