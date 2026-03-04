export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#001224]/95 backdrop-blur-md border-t border-slate-800/80 py-4 sm:py-3 px-4 sm:px-6 z-20 shrink-0 mt-auto">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-4">
        
        {/* Copyright */}
        <div className="text-slate-500 text-[10px] sm:text-xs text-center md:text-left order-3 md:order-1">
          &copy; {currentYear} Prefeitura de Joinville e Hospital Municipal São José.<br className="md:hidden" /> Todos os direitos reservados.
        </div>

        {/* Links Internos - Empilhados no celular, lado a lado no tablet/desktop */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-slate-400 text-[10px] sm:text-xs font-light order-2">
          <a href="#" className="hover:text-nexus-primary transition-colors py-1 sm:py-0">Termos de Uso</a>
          <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-600"></span>
          <a href="#" className="hover:text-nexus-primary transition-colors py-1 sm:py-0">Política de Privacidade</a>
          <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-600"></span>
          <a href="https://github.com/bruvini" target="_blank" rel="noopener noreferrer" className="hover:text-nexus-primary transition-colors py-1 sm:py-0">Repositório GitHub</a>
        </div>

        {/* Assinatura do Desenvolvedor */}
        <div className="flex items-center gap-3 bg-white/5 sm:bg-transparent px-4 py-2 sm:p-0 rounded-full sm:rounded-none order-1 md:order-3">
          <span className="text-slate-400 text-[10px] sm:text-xs font-light">
            Desenvolvido por <strong className="font-medium text-slate-300">Enf. Bruno Vinícius</strong>
          </span>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            <a href="https://www.linkedin.com/in/enfbrunovinicius/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#0A66C2] hover:scale-110 transition-all" title="LinkedIn">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
            <a href="https://github.com/bruvini" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white hover:scale-110 transition-all" title="GitHub">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}