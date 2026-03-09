export default function TopicoCadastro() {
    return (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                <svg className="w-6 h-6 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Cadastro de Solicitações e Importação
            </h3>

            <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">
                A porta de entrada do módulo Operacional. É aqui que novas solicitações ambulatoriais com indicação cirúrgica dão entrada no sistema, passando inicialmente pelo crivo documental antes de seguirem para a regulação do mapa estadual cirúrgico.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                        <span className="bg-sky-100 text-sky-600 p-1.5 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </span>
                        Cadastro Manual
                    </h4>
                    <p className="text-[13px] text-slate-600">
                        Formulário em duas etapas com validação estruturada. Na Etapa 1, os dados biográficos (CNS, Nome, Nascimento) e clínicos são informados. Na Etapa 2, define-se o Procedimento SIGTAP e a Especialidade Médica. O <strong>Número do SISREG</strong> é opcional neste momento.
                    </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                        <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </span>
                        Importação em Lote (Excel)
                    </h4>
                    <p className="text-[13px] text-slate-600">
                        Permite popular grandes filas regulatórias via arquivo `.xlsx`. O sistema varre linhas com as colunas CNS, NOME, PROCEDIMENTO. Aqueles importados sem indicação de número do SISREG são agrupados em uma fila morta de triagem automática e aguardam identificador.
                    </p>
                </div>
            </div>

            <div className="mt-6 bg-orange-50 p-4 rounded-xl border border-orange-100">
                <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Comportamento Automático do SISREG
                </h4>
                <ul className="list-disc list-inside text-[13px] text-orange-700 space-y-1">
                    <li>Se o paciente for cadastrado/importado <strong>COM</strong> o Número do SISREG Estadual: A solicitação avança automaticamente para a fila de "Validação SISREG".</li>
                    <li>Se o paciente for cadastrado/importado <strong>SEM</strong> o Número do SISREG Estadual: A solicitação fica congelada no status contingencial "Aguarda Número SISREG" até atuação logística.</li>
                </ul>
            </div>
        </section>
    );
}
