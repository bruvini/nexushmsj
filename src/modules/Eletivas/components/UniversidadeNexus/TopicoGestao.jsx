export default function TopicoGestao() {
    return (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Gestão de AIHs (Dashboard de Status Clínico)
            </h3>

            <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">
                Este é o coração metodológico da regulação de cirurgias. Todas as solicitações são convertidas em recursos <strong>"ServiceRequest"</strong> (modelo FHIR), sendo agrupadas de forma condicional nas filas hospitalares (as sanfonas do painel) em tempo-real via WebSocket.
            </p>

            <h4 className="font-bold text-slate-800 text-sm mt-6 mb-3">As Etapas e seus Acordeões:</h4>

            <ul className="flex flex-col gap-4 text-sm text-slate-600 font-medium">
                <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-orange-500 shrink-0 shadow-inner mt-0.5"></div>
                    <div>
                        <strong>Aguarda Número do SISREG:</strong>
                        <p className="text-xs text-slate-500 font-normal">Fila restrita. Pacientes importados ou registrados sem a marcação externa de SISREG. O botão vermelho "Registrar SISREG" na tabela é uma via rápida de destravamento.</p>
                    </div>
                </li>
                <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-amber-500 shrink-0 shadow-inner mt-0.5"></div>
                    <div>
                        <strong>Validação SISREG:</strong>
                        <p className="text-xs text-slate-500 font-normal">Revisão por parte do regulador. O sistema atesta que possuem o número estadual, mas aguardam o <i>Ok</i> da auditoria interna.</p>
                    </div>
                </li>
                <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-blue-500 shrink-0 shadow-inner mt-0.5"></div>
                    <div>
                        <strong>Aguarda Parecer:</strong>
                        <p className="text-xs text-slate-500 font-normal">O Médico Regulador (Corpo Clínico) precisa abrir o botão "Parecer da Regulação" e opinar clinicamente se a cirurgia será deferida ou recusada, com base em evidências SIGTAP.</p>
                    </div>
                </li>
                <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-emerald-500 shrink-0 shadow-inner mt-0.5"></div>
                    <div>
                        <strong>Aguarda Entrar no mapa:</strong>
                        <p className="text-xs text-slate-500 font-normal">O paciente está verde, validado e com parecer assinado. Ele repousa neste grid apenas aguardando a marcação cirúrgica pelo mapa de centro cirúrgico.</p>
                    </div>
                </li>
                <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-pink-500 shrink-0 shadow-inner mt-0.5"></div>
                    <div>
                        <strong>Devolvidas (Traumas, Ortopedia Infantil e Pediátrica):</strong>
                        <p className="text-xs text-slate-500 font-normal">Casos reavaliados cujo nível de urgência impôs que não devessem aguardar eletivamente. Foram devolvidos ou mudados de fila (Deliberação CIB).</p>
                    </div>
                </li>
            </ul>

            <div className="mt-8 bg-sky-50 px-4 py-4 rounded-xl border border-sky-100 flex items-start flex-col sm:flex-row gap-4">
                <div className="shrink-0">
                    <svg className="w-8 h-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <div>
                    <h4 className="text-sm font-bold text-sky-800 mb-1">O Botão Parecer da Regulação (Ações Clínicas)</h4>
                    <p className="text-[13px] text-sky-700 leading-relaxed">
                        Disponível em qualquer card de paciente, é um formulário dinâmico capaz de <strong>Mover o Paciente de Fila.</strong> Ao selecioná-lo, dependendo do <i>Status</i> que o regulador atesta (ex: "Exames Anteriores, Trauma, ou Procedimento Eletivo Aprovado"), o paciente transita fisicamente ao vivo e de forma blindada aos logs de Histórico rastreáveis do SUS.
                    </p>
                </div>
            </div>
        </section>
    );
}
