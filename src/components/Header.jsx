import { useNavigate } from 'react-router-dom'

export default function Header({ title, icon, badge, description, backPath = '/' }) {
  const navigate = useNavigate()

  return (
    <header className="bg-nexus-card border-b border-nexus-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-sm sticky top-0 z-10 shrink-0">
      
      {/* Esquerda: Botão Voltar + Título */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={() => navigate(backPath)}
          className="text-nexus-text/60 hover:text-nexus-primary transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium bg-slate-100 hover:bg-nexus-primary/10 px-2.5 sm:px-3 py-1.5 rounded-lg"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="h-6 w-px bg-nexus-border hidden sm:block"></div>
        <h1 className="text-lg sm:text-xl font-bold text-nexus-text tracking-tight flex items-center gap-2">
          {/* Renderiza o ícone dinamicamente se ele for passado */}
          {icon && <div className="text-nexus-primary w-5 h-5 sm:w-6 sm:h-6">{icon}</div>}
          <span className="line-clamp-1">{title}</span>
        </h1>
      </div>

      {/* Direita: Descrição do Módulo (Escondido no Mobile para poupar espaço) */}
      <div className="hidden md:flex flex-col items-end text-right">
        {badge && (
          <span className="text-[10px] sm:text-xs font-semibold text-nexus-primary uppercase tracking-widest">
            {badge}
          </span>
        )}
        {description && (
          <p className="text-xs sm:text-sm text-nexus-text/60 font-light mt-0.5">
            {description}
          </p>
        )}
      </div>
    </header>
  )
}