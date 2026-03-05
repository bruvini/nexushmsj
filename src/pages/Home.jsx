import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Footer from "../components/Footer";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "NEXUS HMSJ | Hub Central";
  }, []);

  const modules = [
    {
      title: "AIHs Cirurgias Eletivas",
      active: true,
      path: "/eletivas",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Kanban de Altas",
      active: true,
      path: "/kanban-altas",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "Regulação de Leitos",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      title: "Marcação Cirúrgica",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "EMAD",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      title: "Telemonitoramento AVC",
      active: true,
      path: "/telemonitoramento-avc",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Serviço Social EMAD/NIR",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      title: "Gestão de Leitos UTI",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      title: "CCIH",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "Higienização",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
    {
      title: "Indicadores",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: "Plano Operativo Anual (POA)",
      active: false,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#001730] to-[#002B54] flex flex-col relative overflow-x-hidden font-sans">
      {/* Luzes de Fundo responsivas */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] bg-sky-500/10 rounded-full blur-[80px] lg:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] bg-purple-500/10 rounded-full blur-[80px] lg:blur-[120px] pointer-events-none"></div>

      {/* Conteúdo Principal (Centralizado verticalmente e adaptável) */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 sm:p-8 lg:p-12 gap-8 lg:gap-16 z-10 w-full max-w-[1400px] mx-auto mt-6 lg:mt-0"
      >

        {/* Coluna Esquerda: Informações e Correlação */}
        <div className="flex flex-col items-center lg:items-start justify-center w-full lg:w-2/5 shrink-0 text-center lg:text-left">
          <img
            src="/Nexus_Logo_Completo.png"
            alt="Nexus Hub Logo"
            className="w-48 sm:w-64 lg:w-80 object-contain drop-shadow-2xl mb-4 lg:mb-6"
          />
          <p className="text-slate-300 text-xs sm:text-sm font-light leading-relaxed tracking-wide mb-6 lg:mb-8 px-2 sm:px-8 lg:px-0">
            O Nexus é o coração tecnológico do Hospital Municipal São José. Mais do que uma plataforma, ele é o elo que une cada profissional e cada dado, garantindo que a jornada do paciente seja fluida, segura e inteligente, do momento da internação até o cuidado em casa.
          </p>

          {/* Bloco de Correlação (Glassmorphism sutil) */}
          <div className="w-full max-w-sm lg:max-w-none bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-lg relative overflow-hidden group text-left">
            <div className="absolute top-0 left-0 w-1 h-full bg-sky-500/50 group-hover:bg-sky-400 transition-colors"></div>
            <h3 className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2 sm:mb-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Sincronicidade de Dados
            </h3>
            <p className="text-slate-400 text-[11px] sm:text-xs leading-relaxed text-justify">
              No HMSJ, nada acontece isolado. Imagine que quando uma cirurgia é marcada no módulo de Eletivas, a Higienização já se prepara para o próximo leito e o Serviço Social organiza o apoio para a alta. O Nexus funciona como um fio invisível que conecta todos esses pontos: se uma vaga se abre na UTI ou um exame fica pronto, o hospital inteiro 'ouve' e reage em tempo real. Assim, o paciente não fica parado em filas invisíveis e o cuidado nunca sofre interrupções.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Grid de Módulos */}
        <div className="w-full lg:w-3/5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl lg:rounded-[2rem] p-4 sm:p-6 lg:p-8 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4 sm:mb-6 px-1 sm:px-2">
            <h2 className="text-[10px] sm:text-xs font-medium text-sky-400 uppercase tracking-widest opacity-80">
              Ecossistema Nexus
            </h2>
            <div className="h-px bg-gradient-to-r from-white/20 to-transparent flex-1 ml-3 sm:ml-4"></div>
          </div>

          {/* Grid responsivo: 2 colunas no celular, 3 no tablet/desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 pb-2">
            {modules.map((module, index) =>
              module.active ? (
                /* Card Ativo */
                <button
                  key={index}
                  onClick={() => navigate(module.path)}
                  className="group relative overflow-hidden bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:bg-white border border-white/20 hover:border-sky-400 hover:shadow-[0_10px_20px_-5px_rgba(2,132,199,0.4)] flex flex-col items-center justify-center h-24 sm:h-32"
                >
                  <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2 w-full">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300">
                      <div className="w-4 h-4 sm:w-6 sm:h-6">{module.icon}</div>
                    </div>
                    <span className="font-normal text-slate-100 text-[11px] sm:text-sm text-center leading-tight group-hover:text-slate-800 transition-colors tracking-wide">
                      {module.title}
                    </span>
                  </div>
                </button>
              ) : (
                /* Card Suspenso/Futuro */
                <div
                  key={index}
                  className="group relative overflow-hidden bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-left transition-all duration-500 border border-white/5 flex flex-col items-center justify-center h-24 sm:h-32 cursor-default"
                >
                  <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2 w-full transition-all duration-500 group-hover:opacity-10 group-hover:blur-[2px]">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400/60 transition-all duration-300">
                      <div className="w-4 h-4 sm:w-6 sm:h-6">{module.icon}</div>
                    </div>
                    <span className="font-light text-slate-400/70 text-[10px] sm:text-sm text-center leading-tight tracking-wide">
                      {module.title}
                    </span>
                  </div>

                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400/80 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sky-300/90 font-medium tracking-widest text-[9px] sm:text-[10px] uppercase">
                      Em breve
                    </span>
                  </div>
                </div>
              )
            )}

            {/* Botão de "Novos Módulos" */}
            <div className="group relative overflow-hidden bg-transparent border-2 border-dashed border-sky-500/30 rounded-xl p-3 sm:p-4 text-left transition-all duration-300 flex flex-col items-center justify-center h-24 sm:h-32 cursor-default">
              <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2 w-full">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400/80 group-hover:scale-110 group-hover:bg-sky-500/20 transition-all duration-300">
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span className="font-medium text-sky-400/80 text-[10px] sm:text-xs text-center leading-tight tracking-wide">
                  Novos módulos sendo <br className="hidden sm:block" /> construídos
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.main>

      <Footer />
    </div>
  );
}