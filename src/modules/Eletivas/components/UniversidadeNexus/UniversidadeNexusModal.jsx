import TopicoCadastro from './TopicoCadastro';
import TopicoGestao from './TopicoGestao';
import TopicoConfiguracoes from './TopicoConfiguracoes';

export default function UniversidadeNexusModal({ onClose }) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden">

                {/* Header no Template Universidade Kanban */}
                <div className="bg-indigo-600 p-8 text-center relative overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <h2 className="text-2xl font-black text-white relative z-10 font-sans flex justify-center items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                            </svg>
                        </div>
                        Universidade Nexus: Cirurgias Eletivas e AIH
                    </h2>
                    <p className="text-indigo-100 mt-2 font-medium relative z-10 text-sm">
                        Guia prático para regulação hospitalar, mapeamento de demandas e aprovação de AIHs cirúrgicas.
                    </p>
                    <button onClick={onClose} className="absolute top-5 right-5 text-indigo-200 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full z-20">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Body Space Scrollável */}
                <div className="p-8 overflow-y-auto bg-slate-50 space-y-8 flex-1">

                    <TopicoCadastro />
                    <TopicoGestao />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                            <TopicoConfiguracoes />
                        </div>
                    </div>

                    {/* Dica Anti Erro baseada no Kanban "O Que NÂO Fazer" */}
                    <section className="bg-rose-50 p-6 rounded-2xl border border-rose-200 shadow-sm">
                        <h3 className="text-lg font-bold text-rose-800 flex items-center gap-2 mb-3">
                            <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Evite Falsos Triados!
                        </h3>
                        <p className="text-sm text-rose-700 font-bold leading-relaxed mb-2">A Tabela é um Ambiente de Log Vivo (Auditoria FHIR).</p>
                        <div className="bg-white p-4 rounded-xl text-rose-600 text-[13px] font-medium leading-relaxed border border-rose-100 flex items-start gap-4">
                            <svg className="w-6 h-6 shrink-0 opacity-80 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            <p>O Fluxo Nexus é regido por rastreabilidade. Em casos de erros ao importar uma base paralela no "Cadastro Automático em Lote" gerando filas sujas sem Sisreg não tente apagar a base 1 por 1. Faça com atenção. Nunca "Mude para Devolvida CIB" como tentativa de exclusão do paciente. A alteração de filas (Avaliação - Devolvida) representa oficialmente os anais de histórico da Secretaria.</p>
                        </div>
                    </section>

                    {/* Fallback Reference Técnico */}
                    <div className="mt-8 text-center text-xs text-slate-400 font-medium">
                        Em caso de dúvidas técnicas não cobertas por este material, entre em contato via e-mail corporativo: <br />
                        <span className="text-indigo-500">bruno.vinicius@joinville.sc.gov.br</span>
                    </div>

                </div>

            </div>
        </div>
    );
}
