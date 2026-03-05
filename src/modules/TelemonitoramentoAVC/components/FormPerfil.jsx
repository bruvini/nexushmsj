import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getPacientes, getComprehensivePatientData } from '../services/avcService';

export default function FormPerfil() {
    const [pacientesList, setPacientesList] = useState([]);
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [loadingPerfil, setLoadingPerfil] = useState(false);

    // Unified state for patient profile (from 5 collections)
    const [perfilData, setPerfilData] = useState(null);

    useEffect(() => {
        fetchPacientesList();
    }, []);

    const fetchPacientesList = async () => {
        setLoadingInitial(true);
        const res = await getPacientes();
        if (res.success) {
            // Sort to make search easier
            const sorted = res.data.sort((a, b) => a.nome.localeCompare(b.nome));
            setPacientesList(sorted);
        } else {
            toast.error('Erro ao carregar pacientes.');
        }
        setLoadingInitial(false);
    };

    const handlePatientChange = async (e) => {
        const pId = e.target.value;
        setSelectedPatientId(pId);

        // Reset state
        setPerfilData(null);

        if (!pId) return;

        setLoadingPerfil(true);
        const pRes = await getComprehensivePatientData(pId);

        if (pRes.success) {
            setPerfilData(pRes.data);
        } else {
            toast.error(pRes.error || 'Erro ao carregar prontuário consolidado.');
        }
        setLoadingPerfil(false);
    };

    // Helper functions
    const formatDateBr = (dateInput) => {
        if (!dateInput) return 'Não registrada';

        let dateObj;
        if (typeof dateInput === 'string') {
            dateObj = new Date(dateInput);
        } else if (dateInput && dateInput.toDate) {
            // Firestore timestamp
            dateObj = dateInput.toDate();
        } else {
            return 'Formato inválido';
        }

        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    const formatDateTimeBr = (dateInput) => {
        if (!dateInput) return 'Não registrada';

        let dateObj;
        if (typeof dateInput === 'string') {
            dateObj = new Date(dateInput);
        } else if (dateInput && dateInput.toDate) {
            dateObj = dateInput.toDate();
        } else {
            return 'Formato inválido';
        }

        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        const hrs = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} às ${hrs}:${mins}`;
    };

    const getTimelineItems = (data) => {
        if (!data) return [];

        const items = [];

        // Consultas
        data.consultas.forEach(c => {
            items.push({
                type: 'CONSULTA',
                date: c.data_agendamento ? new Date(c.data_agendamento) : null,
                color: 'purple',
                icon: '📅',
                title: `Consulta: ${c.status}`,
                desc: c.status === 'CONFIRMADO'
                    ? `Agendada para ${formatDateBr(c.data_agendamento)} às ${c.hora_agendamento}`
                    : `Status: ${c.status}`
            });
        });

        // Contatos
        data.contatos.forEach(c => {
            let stampDate = c.data_contato ? (c.data_contato.toDate ? c.data_contato.toDate() : new Date(c.data_contato)) : null;
            items.push({
                type: 'CONTATO CRM',
                date: stampDate,
                color: 'emerald',
                icon: '📞',
                title: `Contato via ${c.meio_contato}`,
                desc: `${c.categoria_desfecho}. Duração: ${c.duracao_minutos} min. ${c.observacoes ? 'Obs: ' + c.observacoes : ''}`
            });
        });

        // Exames (Only Concluídos or Cancelados to show history)
        data.exames.forEach(e => {
            // Exames usually have a check date when concluded
            if (e.status === 'CONCLUÍDO' || e.status === 'CANCELADO') {
                let stampDate = e.data_checagem ? (e.data_checagem.toDate ? e.data_checagem.toDate() : new Date(e.data_checagem)) : null;
                items.push({
                    type: 'EXAME',
                    date: stampDate,
                    color: 'amber',
                    icon: '🔬',
                    title: `Exame ${e.status}: ${e.nome || e.exame_nome}`,
                    desc: e.resultado ? `Resultado: ${e.resultado}` : 'Sem laudo registrado'
                });
            }
        });

        // Desfechos
        data.desfechos.forEach(d => {
            let stampDate = d.data_registro ? (d.data_registro.toDate ? d.data_registro.toDate() : new Date(d.data_registro)) : null;
            items.push({
                type: 'DESFECHO CLÍNICO',
                date: stampDate,
                color: 'red',
                icon: '🏁',
                title: `Desfecho: ${d.resultado_consulta}`,
                desc: d.observacoes || 'Sem observações'
            });
        });

        // Sort naturally by date descending
        items.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date - a.date;
        });

        return items;
    };

    // ==========================================
    // RENDER LAYOUTS
    // ==========================================

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-sky-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando base de pacientes...
                </span>
            </div>
        );
    }

    const timelineItems = getTimelineItems(perfilData);

    return (
        <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-6xl mx-auto animate-fadeIn min-h-[600px]">

            <div className="mb-6 border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Prontuário Eletrônico / Perfil do Paciente</h2>
                    <p className="text-sm text-slate-500 mt-1 font-light">Visão 360 graus do histórico de interações, exames e dados vitais do paciente pós-AVC.</p>
                </div>
            </div>

            {/* SELETOR DE BUSCA */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-8 relative z-10">
                <label className="text-xs font-semibold text-sky-800 uppercase tracking-wider mb-2 block">
                    Busca de Paciente
                </label>
                <select
                    value={selectedPatientId}
                    onChange={handlePatientChange}
                    className="w-full px-4 py-3 bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                >
                    <option value="">-- Digite ou Selecione para Pesquisar --</option>
                    {pacientesList.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.nome} (Pro: {p.prontuario || 'N/I'}) - {p.status_monitoramento_atual}
                        </option>
                    ))}
                </select>
            </div>

            {/* CONTEÚDO */}
            {!selectedPatientId ? (
                <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400">
                    <svg className="w-16 h-16 mb-4 opacity-50 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                    </svg>
                    <p className="text-lg font-medium">Nenhum prontuário carregado</p>
                    <p className="text-sm mt-1">Busque um paciente no seletor acima para abrir a visão 360.</p>
                </div>
            ) : loadingPerfil ? (
                // SKELETON LOADERS
                <div className="flex flex-col lg:flex-row gap-6 animate-pulse">
                    {/* Skeleton Esquerda */}
                    <div className="w-full lg:w-[320px] bg-white border border-slate-200 rounded-xl p-6 h-[400px]">
                        <div className="w-16 h-16 bg-slate-200 rounded-full mb-4"></div>
                        <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                        <div className="space-y-3">
                            <div className="h-4 bg-slate-200 rounded w-full"></div>
                            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    </div>
                    {/* Skeleton Direita */}
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 h-[600px]">
                        <div className="h-6 bg-slate-200 rounded w-1/4 mb-8"></div>
                        <div className="space-y-6">
                            <div className="h-20 bg-slate-200 rounded-xl w-full"></div>
                            <div className="h-20 bg-slate-200 rounded-xl w-3/4"></div>
                            <div className="h-20 bg-slate-200 rounded-xl w-full"></div>
                        </div>
                    </div>
                </div>
            ) : perfilData ? (
                // DADOS CARREGADOS COMPLETO
                <div className="flex flex-col lg:flex-row gap-6 animate-fadeIn">

                    {/* ======================= COLUNA ESQUERDA (BIO) ======================= */}
                    <div className="w-full lg:w-[320px] shrink-0 space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                            {/* Accent Line */}
                            <div className="h-1.5 w-full bg-sky-500"></div>

                            <div className="p-6">
                                <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">{perfilData.paciente.nome}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-6">
                                    <span>{perfilData.paciente.idade} anos</span>
                                    <span>•</span>
                                    <span>{perfilData.paciente.sexo || 'N/I'}</span>
                                    <span>•</span>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs select-all">Pr: {perfilData.paciente.prontuario || 'N/I'}</span>
                                </div>

                                {/* Contatos Rápidos */}
                                <div className="space-y-2 mb-6">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações de Contato</p>
                                    {[perfilData.paciente.telefone, perfilData.paciente.telefone2, perfilData.paciente.telefone3].filter(Boolean).map((t, idx) => (
                                        <a key={idx} href={`tel:${t}`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-sky-600 group transition-colors p-2 bg-slate-50 rounded-lg border border-slate-100 hover:border-sky-200">
                                            <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                                            </div>
                                            {t}
                                        </a>
                                    ))}
                                </div>

                                {/* Anticoagulante ALERTA */}
                                {perfilData.paciente.usaAnticoagulante && (
                                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
                                        <div className="text-red-500 mt-0.5">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-red-800">Uso de Anticoagulante</p>
                                            <p className="text-xs text-red-600 mt-0.5 leading-tight">Registrado na medicação de alta. Atenção em condutas clínicas.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Status Monitoramento */}
                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Fase Atual da Linha de Cuidado</p>
                                    <div className="bg-sky-50 text-sky-700 font-semibold px-3 py-2 rounded-lg text-sm text-center border border-sky-100">
                                        {perfilData.paciente.status_monitoramento_atual}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* ======================= COLUNA DIREITA (TIMELINE) ======================= */}
                    <div className="flex-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Linha do Tempo de Interações Clínicas
                            </h3>

                            {timelineItems.length === 0 ? (
                                <p className="text-slate-500 text-sm italic py-4 text-center">Nenhum evento registrado no histórico para este paciente após a triagem.</p>
                            ) : (
                                <div className="space-y-4">
                                    {timelineItems.map((item, idx) => {

                                        // Dynamic Color Mapping based on type
                                        const colorMaps = {
                                            purple: 'border-l-purple-500 bg-purple-50 text-purple-700 marker-purple',
                                            amber: 'border-l-amber-500 bg-amber-50 text-amber-700 marker-amber',
                                            emerald: 'border-l-emerald-500 bg-emerald-50 text-emerald-700 marker-emerald',
                                            red: 'border-l-red-500 bg-red-50 text-red-700 marker-red'
                                        };

                                        const theme = colorMaps[item.color] || 'border-l-slate-400 bg-slate-50 text-slate-700';

                                        return (
                                            <div key={idx} className={`relative block rounded-xl border border-slate-100 shadow-sm border-l-4 p-4 pl-5 transition-transform hover:-translate-x-1 hover:shadow-md ${theme.split(' ')[0]} bg-white`}>

                                                {/* Header Row */}
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{item.icon}</span>
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 ${theme.split(' ')[2]}`}>
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-400">
                                                        {item.date ? formatDateTimeBr(item.date) : 'Data não registrada'}
                                                    </span>
                                                </div>

                                                {/* Meta */}
                                                <h4 className="text-base font-bold text-slate-800 mt-2">{item.title}</h4>

                                                {/* Desc */}
                                                <p className="text-sm text-slate-600 mt-1.5 w-full md:w-5/6 leading-relaxed">
                                                    {item.desc}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

        </div>
    );
}
