import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getPacientes, closeMonitoring, deletePatientCompletely } from '../services/avcService';

export default function FormEncerrar() {
    const [pacientesList, setPacientesList] = useState([]);
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [actionType, setActionType] = useState(''); // 'DESISTÊNCIA', 'ÓBITO', 'EXCLUIR'

    // Form fields for closing
    const [dataFalecimento, setDataFalecimento] = useState('');
    const [observacoes, setObservacoes] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

    useEffect(() => {
        fetchPacientesList();
    }, []);

    const fetchPacientesList = async () => {
        setLoadingInitial(true);
        const res = await getPacientes();
        if (res.success) {
            const sorted = res.data.sort((a, b) => a.nome.localeCompare(b.nome));
            setPacientesList(sorted);
        } else {
            toast.error('Erro ao carregar pacientes.');
        }
        setLoadingInitial(false);
    };

    const handlePatientChange = (e) => {
        setSelectedPatientId(e.target.value);
        setActionType('');
        setDataFalecimento('');
        setObservacoes('');
        setConfirmDeleteStep(false);
    };

    const handleActionChange = (type) => {
        setActionType(type);
        setConfirmDeleteStep(false);
        if (type !== 'ÓBITO') {
            setDataFalecimento('');
        }
    };

    const handleSubmit = async () => {
        if (!selectedPatientId) {
            toast.warning('Selecione um paciente.');
            return;
        }

        if (!actionType) {
            toast.warning('Selecione uma ação de encerramento ou exclusão.');
            return;
        }

        if (actionType === 'ÓBITO' && !dataFalecimento) {
            toast.warning('Informe a data do falecimento.');
            return;
        }

        if (actionType === 'EXCLUIR') {
            if (!confirmDeleteStep) {
                setConfirmDeleteStep(true);
                return; // Aguarda o segundo clique
            }

            const confirmAlert = window.confirm("ATENÇÃO: Você está prestes a excluir todos os registros vinculados a este paciente. Esta ação NÃO PODE SER DESFEITA. Deseja prosseguir?");
            if (!confirmAlert) {
                setConfirmDeleteStep(false);
                return;
            }

            setIsSubmitting(true);
            const res = await deletePatientCompletely(selectedPatientId);
            setIsSubmitting(false);

            if (res.success) {
                toast.success('Paciente excluído do sistema permanentemente.');
                setSelectedPatientId('');
                setActionType('');
                setConfirmDeleteStep(false);
                fetchPacientesList(); // Refresh list
            } else {
                toast.error(`Erro ao excluir: ${res.error}`);
            }
            return;
        }

        // Caso ÓBITO ou DESISTÊNCIA
        setIsSubmitting(true);
        const payload = {
            id_paciente: selectedPatientId,
            motivo_encerramento: actionType,
            data_falecimento: actionType === 'ÓBITO' ? dataFalecimento : null,
            observacoes: observacoes
        };

        const res = await closeMonitoring(payload);
        setIsSubmitting(false);

        if (res.success) {
            toast.success(`Monitoramento encerrado por ${actionType}.`);
            setSelectedPatientId('');
            setActionType('');
            setObservacoes('');
            fetchPacientesList(); // Refresh list
        } else {
            toast.error(`Erro ao encerrar: ${res.error}`);
        }
    };

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

    return (
        <div className="bg-red-50/30 rounded-2xl shadow-sm border border-red-100 p-6 md:p-8 max-w-4xl mx-auto animate-fadeIn font-sans">

            <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Painel de Encerramento e Exclusão
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Utilize esta área para interromper o monitoramento de forma definitiva.</p>
            </div>

            <div className="space-y-6">

                {/* 1. SELETOR DE PACIENTE */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 block">
                        Selecionar Paciente
                    </label>
                    <select
                        value={selectedPatientId}
                        onChange={handlePatientChange}
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="">-- Escolha um paciente da base --</option>
                        {pacientesList.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.nome} [{p.status_monitoramento_atual}]
                            </option>
                        ))}
                    </select>
                </div>

                {selectedPatientId && (
                    <div className="animate-fadeIn space-y-6">
                        {/* 2. ÁREA DE OPÇÕES (RÁDIOS) */}
                        <div>
                            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 block">
                                Qual ação deseja tomar?
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                {/* CARD: DESISTÊNCIA */}
                                <button
                                    onClick={() => handleActionChange('DESISTÊNCIA')}
                                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-300 flex flex-col items-center justify-center text-center gap-2
                                        ${actionType === 'DESISTÊNCIA'
                                            ? 'border-amber-500 bg-amber-50 shadow-md'
                                            : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
                                        }`}
                                >
                                    <svg className={`w-8 h-8 ${actionType === 'DESISTÊNCIA' ? 'text-amber-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                                    </svg>
                                    <span className={`font-semibold ${actionType === 'DESISTÊNCIA' ? 'text-amber-800' : 'text-slate-700'}`}>
                                        Desistência
                                    </span>
                                    <p className="text-[10px] text-slate-500 leading-tight">Interrompe chamadas CRM</p>
                                </button>

                                {/* CARD: ÓBITO */}
                                <button
                                    onClick={() => handleActionChange('ÓBITO')}
                                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-300 flex flex-col items-center justify-center text-center gap-2
                                        ${actionType === 'ÓBITO'
                                            ? 'border-red-500 bg-red-50 shadow-md'
                                            : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/50'
                                        }`}
                                >
                                    <svg className={`w-8 h-8 ${actionType === 'ÓBITO' ? 'text-red-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                    </svg>
                                    <span className={`font-semibold ${actionType === 'ÓBITO' ? 'text-red-800' : 'text-slate-700'}`}>
                                        Óbito
                                    </span>
                                    <p className="text-[10px] text-slate-500 leading-tight">Marcar desfecho trágico</p>
                                </button>

                                {/* CARD: EXCLUSÃO */}
                                <button
                                    onClick={() => handleActionChange('EXCLUIR')}
                                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-300 flex flex-col items-center justify-center text-center gap-2
                                        ${actionType === 'EXCLUIR'
                                            ? 'border-slate-800 bg-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.3)] ring-2 ring-red-500 ring-offset-2'
                                            : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-100'
                                        }`}
                                >
                                    <svg className={`w-8 h-8 ${actionType === 'EXCLUIR' ? 'text-red-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span className={`font-semibold ${actionType === 'EXCLUIR' ? 'text-white' : 'text-slate-700'}`}>
                                        Excluir Paciente
                                    </span>
                                    <p className={`text-[10px] ${actionType === 'EXCLUIR' ? 'text-slate-400' : 'text-slate-500'} leading-tight`}>Apagar 100% da base</p>
                                </button>
                            </div>
                        </div>

                        {/* 3. AVISOS E CAMPOS DINÂMICOS */}
                        {actionType && (
                            <div className="animate-fadeIn">
                                {actionType === 'EXCLUIR' ? (
                                    <div className="bg-slate-900 text-slate-300 p-5 rounded-xl border border-red-500/50 shadow-lg">
                                        <h4 className="text-red-400 font-bold uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            Zona de Perigo
                                        </h4>
                                        <p className="text-sm">
                                            A exclusão de paciente efetuará uma cascata que removerá <strong className="text-white">todas as consultas, exames, chamadas (CRM) e desfechos</strong> deste prontuário. Esta ação causará a perda total dos dados assistenciais para fins estatísticos. Para registrar o encerramento sem apagar os dados, prefira a opção <strong>Óbito</strong> ou <strong>Desistência</strong>.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                                        <h4 className="text-amber-800 font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Atenção - Alteração no Censo
                                        </h4>
                                        <p className="text-sm text-amber-700 mb-4">
                                            O paciente será marcado com status fechado e sairá das filas de pendência do Telemonitoramento. O histórico será mantido e poderá ser revisto no Prontuário Eletrônico.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {actionType === 'ÓBITO' && (
                                                <div>
                                                    <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">
                                                        Data do Falecimento *
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={dataFalecimento}
                                                        onChange={(e) => setDataFalecimento(e.target.value)}
                                                        className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                                    />
                                                </div>
                                            )}

                                            <div className={actionType === 'ÓBITO' ? '' : 'md:col-span-2'}>
                                                <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">
                                                    Observação Adicional (Opcional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={observacoes}
                                                    onChange={(e) => setObservacoes(e.target.value)}
                                                    placeholder="Família informou por WhatsApp..."
                                                    className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. BOTÃO DE AÇÃO */}
                        {actionType && (
                            <div className="pt-4 flex justify-end">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className={`px-6 py-3 rounded-lg font-medium text-white shadow-sm transition-all flex items-center gap-2
                                        ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                                        ${actionType === 'EXCLUIR'
                                            ? (confirmDeleteStep ? 'bg-red-600 hover:bg-red-700 animate-pulse ring-4 ring-red-500/30' : 'bg-slate-800 hover:bg-slate-900')
                                            : 'bg-red-500 hover:bg-red-600'
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processando...
                                        </>
                                    ) : (
                                        <>
                                            {actionType === 'EXCLUIR' ? (
                                                confirmDeleteStep ? 'CONFIRMAR EXCLUSÃO PERMANENTE' : 'Excluir Todos os Dados'
                                            ) : (
                                                'Registrar Encerramento'
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
