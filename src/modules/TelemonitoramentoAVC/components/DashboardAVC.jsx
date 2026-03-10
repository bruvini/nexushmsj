import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { subscribeDashboardData } from '../services/avcService';
import { differenceInDays, parseISO, format, isValid } from 'date-fns';

export default function DashboardAVC() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = subscribeDashboardData((res) => {
            if (res.success) {
                setDashboardData(res);
            } else {
                toast.error(res.error || 'Erro ao sincronizar Dashboard Kanban.');
            }
            setLoading(false);
        });

        // Cleanup listener when unmounting
        return () => unsubscribe();
    }, []);

    // Filtro reativo
    const filterKanban = (list) => {
        if (!searchTerm) return list;
        const term = searchTerm.toLowerCase();
        return list.filter(item =>
            (item.nome && item.nome.toLowerCase().includes(term)) ||
            (item.prontuario && item.prontuario.toLowerCase().includes(term)) ||
            (item.status && item.status.toLowerCase().includes(term)) ||
            (item.telefone && item.telefone.toLowerCase().includes(term))
        );
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-sky-200 border-dashed rounded-full animate-spin"></div>
                    <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="mt-4 text-slate-500 font-medium animate-pulse">Carregando painel e kpis...</p>
            </div>
        );
    }

    if (!dashboardData) return null;

    const { kpis, kanban } = dashboardData;

    return (
        <div className="animate-fadeIn min-h-[700px] flex flex-col font-sans">

            {/* SEARCH BAR (TOPO) - Sticky no Mobile */}
            <div className="mb-6 sticky top-0 z-20 bg-[#F8F9FA]/90 backdrop-blur-md pt-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:static sm:pt-0 sm:pb-0">
                <div className="relative max-w-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Pesquisar paciente em todo o fluxo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-slate-700 font-medium"
                    />
                </div>
            </div>

            {/* LINHA DE KPIs (Oculto no Mobile) */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {/* Cadastrados */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cadastrados</p>
                        <p className="text-xl font-bold text-slate-800 leading-none mt-1">{kpis.cadastrados}</p>
                    </div>
                </div>

                {/* Ativos */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monitor. Ativos</p>
                        <p className="text-xl font-bold text-sky-700 leading-none mt-1">{kpis.ativos}</p>
                    </div>
                </div>

                {/* Contatos */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contatos CRM</p>
                        <p className="text-xl font-bold text-emerald-700 leading-none mt-1">{kpis.contatos}</p>
                    </div>
                </div>

                {/* Agendados */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Agendas Futuras</p>
                        <p className="text-xl font-bold text-indigo-700 leading-none mt-1">{kpis.agendados}</p>
                    </div>
                </div>

                {/* Concluídos */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Concluídos</p>
                        <p className="text-xl font-bold text-purple-700 leading-none mt-1">{kpis.concluidos}</p>
                    </div>
                </div>
            </div>

            {/* GRID KANBAN RESPONSIVO */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pb-4 items-start">

                {/* COL 1: Acolhimento */}
                <KanbanColumn
                    title="Acolhimento"
                    icon="✋"
                    colorTheme="orange"
                    items={filterKanban(kanban.acolhimento).filter(item => item.status === 'REALIZAR ACOLHIMENTO')}
                />

                {/* COL 2: Exames */}
                <KanbanColumn
                    title="Exames Pendentes"
                    icon="🔬"
                    colorTheme="yellow"
                    items={filterKanban(kanban.exames)}
                />

                {/* COL 3: Agendar */}
                <KanbanColumn
                    title="Precisa Agendar"
                    icon="⏰"
                    colorTheme="red"
                    items={filterKanban(kanban.agendar)}
                />

                {/* COL 4: Próximas */}
                <KanbanColumn
                    title="Próximas Consultas"
                    icon="📅"
                    colorTheme="blue"
                    items={filterKanban(kanban.proximas)}
                />

                {/* COL 5: Desfecho */}
                <KanbanColumn
                    title="Desfecho Pendente"
                    icon="🏁"
                    colorTheme="purple"
                    items={filterKanban(kanban.desfecho)}
                />
            </div>
        </div>
    );
}

// Componente Columns (Renderização Interna)
function KanbanColumn({ title, icon, colorTheme, items }) {

    const themeMaps = {
        orange: { bg: 'bg-orange-50/50', borderTop: 'border-t-orange-400', badge: 'bg-orange-100 text-orange-800' },
        yellow: { bg: 'bg-amber-50/50', borderTop: 'border-t-amber-400', badge: 'bg-amber-100 text-amber-800' },
        red: { bg: 'bg-red-50/50', borderTop: 'border-t-red-500', badge: 'bg-red-100 text-red-800' },
        blue: { bg: 'bg-sky-50/50', borderTop: 'border-t-sky-400', badge: 'bg-sky-100 text-sky-800' },
        purple: { bg: 'bg-purple-50/50', borderTop: 'border-t-purple-400', badge: 'bg-purple-100 text-purple-800' }
    };

    const theme = themeMaps[colorTheme] || themeMaps.blue;

    const renderCardSummary = (card) => {
        if (card.data_inclusao) {
            let diffDias = 0;
            let dataSolicitacaoFormatada = card.data_inclusao;

            try {
                const dataIso = parseISO(card.data_inclusao);
                if (isValid(dataIso)) {
                    diffDias = Math.max(0, differenceInDays(new Date(), dataIso));
                    dataSolicitacaoFormatada = format(dataIso, 'dd/MM/yyyy');
                }
            } catch (err) {
                console.warn('Erro ao formatar data de inclusão', err);
            }

            const textoEspera = diffDias === 0 ? "Solicitado hoje" : `Aguardando há ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`;

            return (
                <div className="flex flex-col gap-1">
                    <div><strong>Data da Solicitação:</strong> {dataSolicitacaoFormatada}</div>
                    <div className="text-amber-600 font-semibold">{textoEspera}</div>
                    <div><strong>Status de Internação:</strong> {card.status || 'Não informado'}</div>
                </div>
            );
        }
        return card.resumo;
    };

    const formatNascimento = (data) => {
        if (!data) return 'N/I';
        try {
            const d = parseISO(data);
            if (isValid(d)) return format(d, 'dd/MM/yyyy');
        } catch (err) {
            console.warn('Erro ao formatar data de nascimento', err);
        }
        return data; // fallback value
    };

    return (
        <div className={`flex flex-col w-full rounded-xl border border-slate-200 ${theme.bg} shadow-sm`}>
            {/* Header da Coluna */}
            <div className={`p-4 border-b border-slate-200 border-t-4 ${theme.borderTop} rounded-t-xl bg-white/60 backdrop-blur flex justify-between items-center`}>
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    {title}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badge}`}>
                    {items.length}
                </span>
            </div>

            {/* Area de scroll dos cartões no Desktop, altura auto no Mobile */}
            <div className="p-3 flex-1 lg:max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
                {items.length === 0 ? (
                    <div className="min-h-[100px] flex items-center justify-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200/50 rounded-lg">
                        Vazio
                    </div>
                ) : (
                    items.map((card) => (
                        <div key={card.id} className="bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-default group relative overflow-hidden">
                            {/* Accent indicator */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.borderTop.replace('border-t-', 'bg-')} opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                            <h4 className="text-sm font-bold text-slate-800 mb-1 leading-tight group-hover:text-slate-900 transition-colors">{card.nome}</h4>

                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium mb-3">
                                <span>Nasc: {formatNascimento(card.dataNascimento)}</span>
                            </div>

                            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 font-medium">
                                {renderCardSummary(card)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
