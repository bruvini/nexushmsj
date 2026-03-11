import { useState, useEffect } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function DashboardKpis() {
    const [kpis, setKpis] = useState({
        totalPacientes: 0,
        ativas: 0,
        aguardaSisreg: 0,
        validacao: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchKpis = async () => {
        setLoading(true);
        try {
            // 1. Total Pacientes Base
            const qPacientes = collection(db, 'nexus_eletivas_pacientes');
            const snapPacientes = await getCountFromServer(qPacientes);

            // 2. Total de AIHs Ativas
            const qAtivas = query(collection(db, 'nexus_eletivas_solicitacoes'), where('situacao', '==', 'ATIVA'));
            const snapAtivas = await getCountFromServer(qAtivas);
            const totalAtivas = snapAtivas.data().count;

            // 3. Gargalo - Aguardando SISREG
            const qAguarda = query(collection(db, 'nexus_eletivas_solicitacoes'), where('status', '==', 'AGUARDA NÚMERO SISREG'));
            const snapAguarda = await getCountFromServer(qAguarda);

            // 4. Gargalo - Validação
            const qValidacao = query(collection(db, 'nexus_eletivas_solicitacoes'), where('status', '==', 'VALIDAÇÃO SISREG'));
            const snapValidacao = await getCountFromServer(qValidacao);

            // 5. Taxa de Prioridade
            const qPrioridade = query(
                collection(db, 'nexus_eletivas_solicitacoes'),
                where('situacao', '==', 'ATIVA'),
                where('prioridade', 'in', ['ONCOLOGIA', 'CARTA DE PRIORIDADE', 'JUDICIAL'])
            );
            const snapPrioridade = await getCountFromServer(qPrioridade);
            const totalComPrioridade = snapPrioridade.data().count;
            const percPrioridade = totalAtivas > 0 ? Math.round((totalComPrioridade / totalAtivas) * 100) : 0;

            setKpis({
                totalPacientes: snapPacientes.data().count,
                ativas: totalAtivas,
                aguardaSisreg: snapAguarda.data().count,
                validacao: snapValidacao.data().count,
                taxaPrioridade: percPrioridade
            });
        } catch (error) {
            console.error('Erro ao buscar KPIs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKpis();
    }, []);

    return (
        <div className="bg-white border text-nexus-text border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-[fadeIn_0.3s_ease-in-out]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                    <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Métricas de Desempenho
                </h2>
                <button
                    onClick={fetchKpis}
                    disabled={loading}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg p-2 transition-colors disabled:opacity-50"
                    title="Atualizar KPIs"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Card 1 */}
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-sky-600">Pacientes Base</span>
                        <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    {loading ? <div className="h-8 bg-sky-200/50 rounded animate-pulse w-1/2 mt-1"></div> : <span className="text-3xl font-black text-sky-800 mt-1">{kpis.totalPacientes}</span>}
                </div>

                {/* Card 2 */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-600">AIHs Ativas</span>
                        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    {loading ? <div className="h-8 bg-indigo-200/50 rounded animate-pulse w-1/2 mt-1"></div> : <span className="text-3xl font-black text-indigo-800 mt-1">{kpis.ativas}</span>}
                </div>

                {/* Card 3 */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-orange-600 leading-tight">Gargalo<br />S/ SISREG</span>
                        <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    {loading ? <div className="h-8 bg-orange-200/50 rounded animate-pulse w-1/2 mt-1"></div> : <span className="text-3xl font-black text-orange-800 mt-1">{kpis.aguardaSisreg}</span>}
                </div>

                {/* Card 4 */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-amber-600 leading-tight">Gargalo<br />Validação</span>
                        <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </div>
                    {loading ? <div className="h-8 bg-amber-200/50 rounded animate-pulse w-1/2 mt-1"></div> : <span className="text-3xl font-black text-amber-800 mt-1">{kpis.validacao}</span>}
                </div>

                {/* Card 5 - Taxa de Prioridade */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 leading-tight">Taxa de<br />Prioridade</span>
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    {loading ? <div className="h-8 bg-emerald-200/50 rounded animate-pulse w-1/2 mt-1"></div> : (
                        <div>
                            <span className="text-3xl font-black text-emerald-800 mt-1">{kpis.taxaPrioridade}%</span>
                            <p className="text-[9px] text-emerald-600/70 leading-tight mt-1">das solicitações ativas possuem prioridade clínica/judicial.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
