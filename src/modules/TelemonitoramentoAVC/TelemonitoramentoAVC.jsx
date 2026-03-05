import { useState, useEffect } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export default function TelemonitoramentoAVC() {
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Simulando estado de loading inicial
        const timer = setTimeout(() => {
            setLoading(false)
            toast.info('Construção inicial do módulo concluída.')
        }, 1200)
        return () => clearTimeout(timer)
    }, [])

    const iconeAVC = (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    )

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Header
                title="Telemonitoramento AVC (Pós-Alta)"
                icon={iconeAVC}
                badge="Módulo Clínico"
                description="Acompanhamento contínuo e preventivo de pacientes pós-AVC"
            />

            <main className="flex-1 p-4 sm:p-6 md:p-8 bg-gradient-to-br from-[#001730] to-[#002B54] relative overflow-hidden flex flex-col items-center justify-center">
                {/* Efeitos de iluminação padrão Nexus */}
                <div className="absolute top-[-10%] left-[-10%] w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] bg-sky-500/10 rounded-full blur-[80px] lg:blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] bg-purple-500/10 rounded-full blur-[80px] lg:blur-[120px] pointer-events-none"></div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-4 text-sky-400 z-10 p-8 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-xl">
                        <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm font-medium tracking-widest uppercase text-sky-300">Carregando dados...</span>
                    </div>
                ) : (
                    <div className="w-full max-w-4xl bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-8 sm:p-12 shadow-2xl flex flex-col items-center text-center z-10 relative group hover:bg-white/10 transition-colors duration-500">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-50"></div>

                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 mb-6 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300">
                            <div className="w-8 h-8 sm:w-10 sm:h-10">
                                {iconeAVC}
                            </div>
                        </div>

                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-100 mb-4 tracking-wide group-hover:text-white transition-colors">
                            Censo de Pacientes AVC
                        </h2>

                        <p className="text-slate-400 text-sm sm:text-base font-light max-w-2xl leading-relaxed group-hover:text-slate-300 transition-colors">
                            O módulo encontra-se em estágio de desenvolvimento. No futuro, este espaço centralizará a visualização em tempo real do censo de pacientes sob telemonitoramento pós-alta, facilitando o contato assertivo e a prevenção secundária.
                        </p>
                    </div>
                )}
            </main>

            <Footer />
            <ToastContainer position="bottom-right" theme="dark" />
        </div>
    )
}
