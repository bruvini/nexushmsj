import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getPendingExamesPatients, getExamsByPatient, updateExamStatus, addExamManually, getAVCConfigs } from '../services/avcService';

export default function FormExames() {
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [pacientesPendentes, setPacientesPendentes] = useState([]);
    const [selectedPacienteId, setSelectedPacienteId] = useState('');

    const [examesPaciente, setExamesPaciente] = useState([]);
    const [loadingExames, setLoadingExames] = useState(false);

    // Datalist do autocomplete
    const [configExames, setConfigExames] = useState([]);
    const [novoExameNome, setNovoExameNome] = useState('');
    const [salvandoExameManual, setSalvandoExameManual] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoadingInitial(true);

        // Busca pacientes na fila
        const pRes = await getPendingExamesPatients();
        if (pRes.success) {
            setPacientesPendentes(pRes.data);
        }

        // Busca dicionário de exames predefinidos para datalist
        const cRes = await getAVCConfigs();
        if (cRes.success) {
            setConfigExames(cRes.data.exames || []);
        }

        setLoadingInitial(false);
    };

    const handlePacienteChange = async (e) => {
        const pId = e.target.value;
        setSelectedPacienteId(pId);

        if (pId) {
            setLoadingExames(true);
            const res = await getExamsByPatient(pId);
            if (res.success) {
                setExamesPaciente(res.data);
            } else {
                toast.error('Gargalo ao buscar os exames.');
            }
            setLoadingExames(false);
        } else {
            setExamesPaciente([]);
        }
    };

    const handleUpdateStatus = async (examId, newStatus) => {
        // Otimistic Update
        const oldExames = [...examesPaciente];
        setExamesPaciente(prev => prev.map(ex => ex.id === examId ? { ...ex, status: newStatus } : ex));

        const res = await updateExamStatus(examId, newStatus, selectedPacienteId);

        if (res.success) {
            toast.info(`Exame ${newStatus === 'CONCLUÍDO' ? 'confirmado como Concluído' : 'Cancelado'}.`);

            if (res.phaseChanged) {
                toast.success('🎉 Todos os exames concluídos! Paciente movido automaticamente para a fila de Agendamento.', {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "colored",
                });
                // Remove da lista atual da UI porque não está mais nessa fase
                setPacientesPendentes(prev => prev.filter(p => p.id !== selectedPacienteId));
                setSelectedPacienteId('');
                setExamesPaciente([]);
            }
        } else {
            // Revert if failed
            toast.error('Erro ao atualizar. Tente novamente.');
            setExamesPaciente(oldExames);
        }
    };

    const handleAddManualExam = async (e) => {
        e.preventDefault();
        const nome = novoExameNome.trim().toUpperCase();
        if (!nome || !selectedPacienteId) return;

        setSalvandoExameManual(true);
        const res = await addExamManually(selectedPacienteId, nome);

        if (res.success) {
            toast.success(`Exame adicional "${nome}" injetado com sucesso!`);
            setExamesPaciente(prev => [...prev, res.data]);
            setNovoExameNome('');
        } else {
            toast.error('Erro ao adicionar exame.');
        }
        setSalvandoExameManual(false);
    }

    const renderBadge = (status) => {
        const colors = {
            'PENDENTE': 'bg-amber-100 text-amber-800 border-amber-200',
            'CONCLUÍDO': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'CANCELADO': 'bg-red-100 text-red-800 border-red-200'
        };

        return (
            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${colors[status] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                {status}
            </span>
        );
    }

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-sky-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Estruturando matriz de exames...
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-5xl mx-auto animate-fadeIn min-h-[500px]">
            <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Gestão de Exames</h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Valide e rastreie o status das imagens de laudos laboratoriais pendentes.</p>
            </div>

            <div className="space-y-6">
                {/* Filtro do Paciente */}
                <div className="bg-sky-50/50 p-5 rounded-xl border border-sky-100">
                    <label className="text-xs font-semibold text-sky-800 uppercase tracking-wider mb-2 block">
                        Selecione o Paciente (Fila: {pacientesPendentes.length})
                    </label>

                    {pacientesPendentes.length === 0 ? (
                        <div className="p-4 bg-white border border-sky-100 rounded-lg text-sm text-slate-500 italic text-center">
                            Não há pacientes aguardando checagem de exames no momento. 🙌
                        </div>
                    ) : (
                        <select
                            value={selectedPacienteId}
                            onChange={handlePacienteChange}
                            className="w-full px-4 py-3 bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                        >
                            <option value="">-- Clique aqui para selecionar --</option>
                            {pacientesPendentes.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                        </select>
                    )}
                </div>

                {selectedPacienteId && (
                    <div className="animate-fadeIn">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                            <h3 className="text-md font-semibold text-slate-700">Painel de Procedimentos</h3>

                            {/* Adição Manual */}
                            <form onSubmit={handleAddManualExam} className="flex items-center gap-2">
                                <datalist id="exames_lista_sugestoes">
                                    {configExames.map(ex => <option key={ex} value={ex} />)}
                                </datalist>

                                <input
                                    type="text"
                                    list="exames_lista_sugestoes"
                                    value={novoExameNome}
                                    onChange={(e) => setNovoExameNome(e.target.value.toUpperCase())}
                                    placeholder="+ DIGITE UM EXAME NOVO"
                                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[200px] bg-slate-50 uppercase shadow-inner"
                                />
                                <button
                                    type="submit"
                                    disabled={salvandoExameManual || !novoExameNome}
                                    className="bg-sky-600 text-white font-medium text-xs px-3 py-2.5 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm whitespace-nowrap"
                                >
                                    {salvandoExameManual ? 'Salvando...' : 'Adicionar Adicional'}
                                </button>
                            </form>
                        </div>

                        {loadingExames ? (
                            <div className="space-y-3">
                                {/* Skeleton Loaders */}
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse w-full border border-slate-200"></div>
                                ))}
                            </div>
                        ) : (
                            examesPaciente.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm relative w-full">
                                    <table className="min-w-full divide-y divide-slate-200 w-full text-left">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    Nome do Exame
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                                                    Origem
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    Ações
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100">
                                            {examesPaciente.map((exame) => (
                                                <tr key={exame.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-slate-800">{exame.nome}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 md:hidden">{exame.origem}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                                        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 inline-block rounded-md border border-slate-200">
                                                            {exame.origem}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {renderBadge(exame.status)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        {exame.status === 'PENDENTE' ? (
                                                            <div className="flex justify-end gap-2 isolate">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(exame.id, 'CONCLUÍDO')}
                                                                    title="Marcar como Concluído"
                                                                    className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-full transition-colors z-10"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(exame.id, 'CANCELADO')}
                                                                    title="Cancelar Pedido"
                                                                    className="text-red-400 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-full transition-colors z-10"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic font-light inline-block w-full text-right pr-2">
                                                                Operação Resolvida
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
                                    <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="mt-2 text-sm font-medium text-slate-900">Sem exames mapeados</h3>
                                    <p className="mt-1 text-xs text-slate-500 opacity-80">Você pode adicionar um pedido novo acima e repassar.</p>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
