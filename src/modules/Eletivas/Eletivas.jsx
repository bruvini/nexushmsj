import { useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import CadastroSolicitacoes from './components/CadastroSolicitacoes' 
import Configuracoes from './components/Configuracoes' 
import GestaoAihs from './components/GestaoAihs'

export default function Eletivas() {
  const [abaAtiva, setAbaAtiva] = useState('cadastro')

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
        <div className="flex gap-4 sm:gap-8 overflow-x-auto custom-scrollbar pb-1">
          <button 
            onClick={() => setAbaAtiva('cadastro')}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
              abaAtiva === 'cadastro' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Cadastro de Solicitações
            {abaAtiva === 'cadastro' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-sky-500 rounded-t-full"></span>}
          </button>
          
          <button 
            onClick={() => setAbaAtiva('gestao')}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
              abaAtiva === 'gestao' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Gestão de AIHs
            {abaAtiva === 'gestao' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-sky-500 rounded-t-full"></span>}
          </button>

          <button 
            onClick={() => setAbaAtiva('configuracoes')}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
              abaAtiva === 'configuracoes' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
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
    </div>
  )
}