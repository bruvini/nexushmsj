export default function TopicoConfiguracoes() {
    return (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Parametrização do Módulo (Configurações)
            </h3>

            <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">
                As engrenagens do módulo residem em "Configurações". O preenchimento autocompletar do cadastro inicial e do parecer regulatório consome estritamente as variáveis parametrizadas neste painel, impedindo que o operador cadastre lixo textual (erros ortográficos de SIGTAP ou Médicos não cadastrados).
            </p>

            <div className="space-y-4">
                <div className="border border-slate-100 rounded-xl p-4">
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Especialidades Médicas</h4>
                    <p className="text-xs text-slate-500">As grandes famílias de regulação (ex: COLOPROCTOLOGIA, ORTOPEDIA - JOELHO, CIRURGIA GERAL). A especialidade é o tronco base do aplicativo Censo, e todo médico e procedimento se acopla a uma (ou mais) especialidade.</p>
                </div>

                <div className="border border-slate-100 rounded-xl p-4">
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Corpo Clínico (Médicos)</h4>
                    <p className="text-xs text-slate-500">O quadro de cirurgiões ou médicos solicitantes / pareceristas. Durante o cadastro de um médico, você deve <strong>obrigatoriamente <i>linkar</i></strong> (check box) a quais caixinhas de Especialidades ele presta serviço, criando o vinculo cruzado.</p>
                </div>

                <div className="border border-slate-100 rounded-xl p-4">
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Procedimentos SIGTAP</h4>
                    <p className="text-xs text-slate-500">A Bíblia cirúrgica. Aqui armazena os códigos SUS (ex: 0408050114 - ARTROPLASTIA DE JOELHO) e as nomenclaturas técnicas que abastecem os "ComboBoxes" do operador e mantêm a padronização HL7. Ao igual os médicos, vinculam-se à Especialidade referenciada.</p>
                </div>
            </div>

            <div className="mt-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Sincronização em Massa (Importação CSV)
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                    A aba oculta de "Importar Lotes" evita jornadas extenuantes de digitação de catálogo. Envie arquivos `CSV` para popular centenas de médicos e SIGTAPs de uma vez. O robô em lote (`writeBatch` Firestore) fará as indexações de forma transacional segura.
                </p>
            </div>

        </section>
    );
}
