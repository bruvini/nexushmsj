import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getConfirmedDates, getDailySchedulePreview, getAVCConfigs, triggerEmailSend } from '../services/avcService';

export default function FormEmail() {
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [datasConfirmadas, setDatasConfirmadas] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');

    const [previewList, setPreviewList] = useState([]);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const [emailsDestino, setEmailsDestino] = useState([]);
    const [responsavel, setResponsavel] = useState('');

    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoadingInitial(true);

        // Load Configs for Emails
        const confRes = await getAVCConfigs();
        if (confRes.success && confRes.data.emails) {
            setEmailsDestino(confRes.data.emails);
        }

        // Load Dates
        const datesRes = await getConfirmedDates();
        if (datesRes.success) {
            setDatasConfirmadas(datesRes.data);
        }

        setLoadingInitial(false);
    };

    const handleDateChange = async (e) => {
        const date = e.target.value;
        setSelectedDate(date);

        if (!date) {
            setPreviewList([]);
            return;
        }

        setLoadingPreview(true);
        const prevRes = await getDailySchedulePreview(date);
        if (prevRes.success) {
            setPreviewList(prevRes.data);
        } else {
            toast.error('Erro ao carregar o preview da agenda.');
            setPreviewList([]);
        }
        setLoadingPreview(false);
    };

    const generateHtmlBody = () => {
        let htmlStr = `
            <div style="font-family: Arial, sans-serif; color: #333; max-w-4xl mx-auto;">
                <h2 style="color: #2563eb; border-bottom: 2px solid #bfdbfe; padding-bottom: 10px;">Nexus HMSJ: Lista Ambulatorial de Telemonitoramento AVC</h2>
                <p><strong>Data da Agenda:</strong> ${selectedDate.split('-').reverse().join('/')}</p>
                <p><strong>Responsável pelo Envio:</strong> ${responsavel || 'Equipe AVC'}</p>
                <br/>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                            <th style="padding: 12px; font-size: 14px;">HORA</th>
                            <th style="padding: 12px; font-size: 14px;">PACIENTE</th>
                            <th style="padding: 12px; font-size: 14px;">IDADE</th>
                            <th style="padding: 12px; font-size: 14px;">PRONTUÁRIO</th>
                            <th style="padding: 12px; font-size: 14px;">STATUS EXAMES</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (previewList.length === 0) {
            htmlStr += `<tr><td colspan="5" style="padding: 15px; text-align: center; font-style: italic;">Nenhum paciente agendado.</td></tr>`;
        }

        previewList.forEach((item, index) => {
            const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

            // Render exames with icons
            let examesHtml = '<ul style="margin: 0; padding-left: 20px; font-size: 12px;">';
            if (item.exames && item.exames.length > 0) {
                item.exames.forEach(ex => {
                    const icone = ex.status === 'CONCLUÍDO' ? '✅' : (ex.status === 'CANCELADO' ? '⛔' : '❌');
                    examesHtml += `<li>${icone} ${ex.nome}</li>`;
                });
            } else {
                examesHtml += `<li><span style="color: #94a3b8;">Sem exames atrelados</span></li>`;
            }
            examesHtml += '</ul>';

            htmlStr += `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; font-weight: bold; font-size: 14px;">${item.hora}</td>
                    <td style="padding: 12px; font-size: 14px;">${item.nome}</td>
                    <td style="padding: 12px; font-size: 14px;">${item.idade}</td>
                    <td style="padding: 12px; font-size: 14px;">${item.prontuario}</td>
                    <td style="padding: 12px;">${examesHtml}</td>
                </tr>
            `;
        });

        htmlStr += `
                    </tbody>
                </table>
                <br/>
                <p style="font-size: 12px; color: #64748b; margin-top: 30px;">
                    E-mail gerado automaticamente pelo Nexus Hub de Inteligência Hospitalar.<br/>
                    Hospital Municipal São José.
                </p>
            </div>
        `;

        return htmlStr;
    };

    const handleSendEmail = async () => {
        if (!selectedDate) {
            toast.warn('Selecione uma data para enviar a lista.');
            return;
        }

        if (!responsavel) {
            toast.warn('Informe o nome do responsável pelo envio.');
            return;
        }

        if (emailsDestino.length === 0) {
            toast.warn('Nenhum destinatário configurado nas Configurações Gerais.');
            return;
        }

        if (previewList.length === 0) {
            if (!window.confirm("A agenda desta data está vazia. Deseja enviar o e-mail mesmo assim?")) {
                return;
            }
        }

        setEnviando(true);

        const htmlBody = generateHtmlBody();
        const dateBr = selectedDate.split('-').reverse().join('/');

        const payload = {
            assunto: `[NEXUS-AVC] Lista Ambulatorial - Agenda: ${dateBr}`,
            remetente_nome: `Nexus AVC (${responsavel})`,
            destinatarios: emailsDestino,
            corpo_html: htmlBody,
            data_alvo: selectedDate
        };

        const res = await triggerEmailSend(payload);

        if (res.success) {
            toast.success('Lista enviada para a fila de disparo com sucesso!');
            setResponsavel('');
            setSelectedDate('');
            setPreviewList([]);
        } else {
            toast.error('Erro ao enfileirar o disparo de e-mail.');
        }

        setEnviando(false);
    };

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando motor de relatórios...
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-6xl mx-auto animate-fadeIn min-h-[500px]">

            <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Envio de Lista Ambulatorial</h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Disparo automático das agendas confirmadas e status de exames para a equipe de apoio.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Lateral Esquerda - Controles */}
                <div className="lg:col-span-1 border-r border-slate-100 pr-0 lg:pr-6 space-y-6">

                    {/* Seletor de Data */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Agendas Confirmadas</label>
                        <select
                            value={selectedDate}
                            onChange={handleDateChange}
                            className="w-full px-4 py-3 bg-blue-50/50 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                        >
                            <option value="">-- Selecione a data --</option>
                            {datasConfirmadas.map(d => (
                                <option key={d} value={d}>{d.split('-').reverse().join('/')}</option>
                            ))}
                        </select>
                        {datasConfirmadas.length === 0 && (
                            <p className="text-[10px] text-red-500 mt-1">Nenhuma consulta confirmada no banco de dados.</p>
                        )}
                    </div>

                    {/* Resumo Destinatários */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Destinatários Auto.</h4>
                        {emailsDestino.length > 0 ? (
                            <ul className="text-xs text-slate-600 space-y-1">
                                {emailsDestino.map((email, i) => (
                                    <li key={i} className="flex items-center gap-1.5 line-clamp-1" title={email}>
                                        <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        <span className="truncate">{email}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-amber-600">⚠ Nenhum e-mail cadastrado em Configurações.</p>
                        )}
                    </div>

                    {/* Responsável e Ação */}
                    <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome do Responsável <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={responsavel}
                                onChange={(e) => setResponsavel(e.target.value)}
                                placeholder="Seu nome"
                                className="px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-700 w-full"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleSendEmail}
                            disabled={enviando || !selectedDate || loadingPreview}
                            className="w-full px-5 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {enviando ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Confirmar e Enviar E-mail
                                </>
                            )}
                        </button>
                    </div>

                </div>

                {/* Área Principal - Tabela Priview */}
                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700">Preview Oficial do Relatório</h3>
                        {selectedDate && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                                {previewList.length} Consulta(s)
                            </span>
                        )}
                    </div>

                    {!selectedDate ? (
                        <div className="h-64 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            <span className="text-sm">Selecione uma data na barra lateral para carregar a tabela.</span>
                        </div>
                    ) : loadingPreview ? (
                        <div className="h-64 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-blue-500 bg-white shadow-sm">
                            <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium animate-pulse">Cruzando dados entre agendas, pacientes e exames...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">Hora</th>
                                        <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Paciente</th>
                                        <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">Idade</th>
                                        <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prontuário</th>
                                        <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-l border-slate-100">Status dos Exames Primários</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {previewList.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-slate-400 font-medium">Nenhum paciente agendado nesta data.</td>
                                        </tr>
                                    ) : (
                                        previewList.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap text-slate-800 font-bold bg-slate-50/50">{item.hora}</td>
                                                <td className="px-5 py-4 whitespace-nowrap text-slate-700 font-medium">{item.nome}</td>
                                                <td className="px-5 py-4 whitespace-nowrap text-slate-500">{item.idade}</td>
                                                <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">{item.prontuario}</td>
                                                <td className="px-5 py-4 text-slate-600 border-l border-slate-50">
                                                    {item.exames && item.exames.length > 0 ? (
                                                        <ul className="space-y-1.5 ml-1">
                                                            {item.exames.map((ex, eIdx) => (
                                                                <li key={eIdx} className="flex items-center gap-2 text-xs">
                                                                    <span className={ex.status === 'CONCLUÍDO' ? 'text-emerald-500' : (ex.status === 'CANCELADO' ? 'text-slate-400' : 'text-rose-500')}>
                                                                        {ex.status === 'CONCLUÍDO' ? '✅' : (ex.status === 'CANCELADO' ? '⛔' : '❌')}
                                                                    </span>
                                                                    <span className={ex.status === 'PENDENTE' ? 'font-medium' : ''}>{ex.nome}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Nenhum exame inicial associado.</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
