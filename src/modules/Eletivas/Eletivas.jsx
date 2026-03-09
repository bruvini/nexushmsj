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
        rightContent={
          <button onClick={() => setShowUniversidade(true)} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-3 sm:px-4 rounded-xl transition-all shadow-sm border border-indigo-200 group">
            <svg className="w-5 h-5 text-indigo-500 group-hover:rotate-12 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
            <span className="hidden sm:inline text-xs sm:text-sm">Universidade Nexus</span>
          </button>
        }
      />

      {/* Ajustado padding e gap para telas menores (px-4 sm:px-8 e gap-4 sm:gap-8) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 pt-4">
        <div className="flex gap-4 sm:gap-8 overflow-x-auto custom-scrollbar pb-1">
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