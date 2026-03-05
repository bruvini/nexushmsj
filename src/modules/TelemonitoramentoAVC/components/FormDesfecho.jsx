import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getPatientsForOutcome, saveOutcome, getAVCConfigs } from '../services/avcService';

export default function FormDesfecho() {
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [pacientes, setPacientes] = useState([]);
    const [selectedPacienteId, setSelectedPacienteId] = useState('');

    const [pacienteAtivo, setPacienteAtivo] = useState(null);
    const [salvando, setSalvando] = useState(false);

    // Opções do Select
    const [opcoesExames, setOpcoesExames] = useState([]);

    // Timer Operacional
    const [seconds, setSeconds] = useState(0);
    const [timerRunning, setTimerRunning] = useState(true);
    const timerRef = useRef(null);

    // States do Formulário
    const [atendimentoRealizado, setAtendimentoRealizado] = useState(true);
    const [resultadoConsulta, setResultadoConsulta] = useState('');
    const [examesSelecionados, setExamesSelecionados] = useState([]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        fetchInitialData();
        startTimer();
        return () => clearInterval(timerRef.current);
    }, []);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setSeconds(prev => prev + 1);
        }, 1000);
        setTimerRunning(true);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimerRunning(false);
    };

    const formatTimer = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const fetchInitialData = async () => {
        setLoadingInitial(true);
        const pRes = await getPatientsForOutcome();
        if (pRes.success) {
            setPacientes(pRes.data);
        }

        const cRes = await getAVCConfigs();
        if (cRes.success) {
            setOpcoesExames(cRes.data.exames || []);
        }

        setLoadingInitial(false);
    };

    const handlePacienteChange = (e) => {
        const pId = e.target.value;
        setSelectedPacienteId(pId);

        // Reset configs
        setAtendimentoRealizado(true);
        setResultadoConsulta('');
        setExamesSelecionados([]);
        setObservacoes('');

        if (pId) {
            const paciente = pacientes.find(p => p.id === pId);
            setPacienteAtivo(paciente);
        } else {
            setPacienteAtivo(null);
        }
    };

    const handleOptionSelect = (optionValue) => {
        setResultadoConsulta(optionValue);
        if (optionValue !== 'RETORNO_EXAMES') {
            setExamesSelecionados([]); // Clean if changed
        }
    };

    const handleExameToggle = (exame) => {
        setExamesSelecionados(prev =>
            prev.includes(exame) ? prev.filter(e => e !== exame) : [...prev, exame]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!resultadoConsulta) {
            toast.warn('Selecione uma opção de desfecho final.');
            return;
        }

        if (resultadoConsulta === 'RETORNO_EXAMES' && examesSelecionados.length === 0) {
            toast.warn('Você selecionou retorno para exames, por favor marque os exames solicitados.');
            return;
        }

        setSalvando(true);

        const outcomeData = {
            id_paciente: pacienteAtivo.id,
            consulta_id: pacienteAtivo.consulta_ref?.id || null, // Vindo do pull
            atendimento_realizado: atendimentoRealizado,
            resultado_consulta: resultadoConsulta,
            exames_solicitados: examesSelecionados,
            observacoes: observacoes
        };

        const res = await saveOutcome(outcomeData, seconds);

        if (res.success) {
            stopTimer();
            toast.success(`Desfecho registrado! Paciente movido para a aba: ${res.novaFase}`);

            await fetchInitialData();
            setSelectedPacienteId('');
            setPacienteAtivo(null);

            setTimeout(() => {
                setSeconds(0);
                startTimer();
            }, 3500);
        } else {
            toast.error('Ocorreu um erro ao salvar o desfecho.');
        }

        setSalvando(false);
    };

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Estruturando matriz de desfechos...
                </span>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-5xl mx-auto animate-fadeIn min-h-[500px] relative">

            {/* Timer Badge */}
            <div className={`absolute top-6 right-8 flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold transition-colors ${timerRunning ? 'bg-white text-slate-600 border-slate-300' : 'bg-purple-100 text-purple-800 border-purple-300 shadow-md'}`}>
                <svg className={`w-4 h-4 ${timerRunning ? 'animate-pulse text-purple-500' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTimer(seconds)}
            </div>

            <div className="mb-8 border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Registro de Desfecho Clínico</h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Determine o fim da linha de cuidado, reinicie ciclos de imagem ou agende retornos.</p>
            </div>

            <div className="space-y-8">
                {/* Filtro do Paciente */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <label className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-2 block">
                        Paciente em Pós-Consulta (Fila: {pacientes.length})
                    </label>

                    <select
                        value={selectedPacienteId}
                        onChange={handlePacienteChange}
                        className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="">-- Clique aqui para selecionar --</option>
                        {pacientes.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.nome} {p.consulta_ref ? `(Cons. ${p.consulta_ref.data_agendamento})` : '(Sem consulta base)'}
                            </option>
                        ))}
                    </select>
                </div>

                {pacienteAtivo && (
                    <form onSubmit={handleSubmit} className="animate-fadeIn space-y-6">

                        {/* Etapa 1: Atendimento Ocorreu? */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">
                                1. A consulta agendada foi realizada?
                            </h3>

                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="atendimento_realizado"
                                        checked={atendimentoRealizado === true}
                                        onChange={() => setAtendimentoRealizado(true)}
                                        className="w-5 h-5 text-purple-600 focus:ring-purple-500 border-slate-300"
                                    />
                                    <span className="text-sm text-slate-700 font-medium group-hover:text-purple-700">Sim, realizada com sucesso</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="atendimento_realizado"
                                        checked={atendimentoRealizado === false}
                                        onChange={() => setAtendimentoRealizado(false)}
                                        className="w-5 h-5 text-purple-600 focus:ring-purple-500 border-slate-300"
                                    />
                                    <span className="text-sm text-slate-700 font-medium group-hover:text-purple-700">Não (Paciente faltou ou remarcou)</span>
                                </label>
                            </div>
                        </div>

                        {/* Etapa 2: Resultado (Options Cards) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">
                                2. {atendimentoRealizado ? 'Resultado da Avaliação Médica' : 'Decisão Pós-Ausência'}
                            </h3>

                            {atendimentoRealizado ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { val: 'ALTA', title: 'Alta Pós-Monitoramento', desc: 'Paciente recuperado, linha de cuidado encerrada.' },
                                        { val: 'ALTA_EMAD', title: 'Alta com Encaminhamento', desc: 'Sairá da rede direta e irá para assistência EMAD.' },
                                        { val: 'RETORNO_EXAMES', title: 'Solicitou Novos Exames', desc: 'Recircula para a fila de Checagem de Exames Pendentes.' },
                                        { val: 'RETORNO_MEDICO', title: 'Agendar Novo Retorno', desc: 'Reavaliação clínica necessária (Encaminhar agenda).' }
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => handleOptionSelect(opt.val)}
                                            className={`p-4 rounded-xl border text-left transition-all ${resultadoConsulta === opt.val ? 'bg-purple-100 border-purple-500 shadow-md ring-2 ring-purple-500/20' : 'bg-slate-50 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'}`}
                                        >
                                            <h4 className={`text-sm font-bold ${resultadoConsulta === opt.val ? 'text-purple-800' : 'text-slate-700'}`}>{opt.title}</h4>
                                            <p className={`text-xs mt-1 ${resultadoConsulta === opt.val ? 'text-purple-600' : 'text-slate-500'}`}>{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { val: 'FALTA_REAGENDAR', title: 'Falta Justificada / Reagendar', desc: 'Manter na fila de Agendamentos (Recircular).' },
                                        { val: 'FALTA_ENCERRAR', title: 'Encerrar por Abandono', desc: 'Múltiplas faltas. Encerrar acompanhamento compulsório.' }
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => handleOptionSelect(opt.val)}
                                            className={`p-4 rounded-xl border text-left transition-all ${resultadoConsulta === opt.val ? 'bg-rose-100 border-rose-500 shadow-md ring-2 ring-rose-500/20' : 'bg-slate-50 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50'}`}
                                        >
                                            <h4 className={`text-sm font-bold ${resultadoConsulta === opt.val ? 'text-rose-800' : 'text-slate-700'}`}>{opt.title}</h4>
                                            <p className={`text-xs mt-1 ${resultadoConsulta === opt.val ? 'text-rose-600' : 'text-slate-500'}`}>{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Subetapa Dinâmica: Seleção de Exames */}
                        {resultadoConsulta === 'RETORNO_EXAMES' && (
                            <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 shadow-inner animate-fadeIn">
                                <h4 className="text-xs font-semibold text-purple-800 uppercase mb-4 tracking-wider">Selecione os Novos Exames Solicitados <span className="text-red-500">*</span></h4>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {opcoesExames.map(exame => (
                                        <label key={exame} className="flex items-start gap-2 cursor-pointer group bg-white p-2 rounded-lg border border-slate-100 hover:border-purple-300 shadow-sm transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={examesSelecionados.includes(exame)}
                                                onChange={() => handleExameToggle(exame)}
                                                className="w-4 h-4 mt-0.5 text-purple-600 bg-slate-50 border-slate-300 rounded focus:ring-purple-500"
                                            />
                                            <span className="text-xs text-slate-700 font-medium group-hover:text-purple-800 leading-tight">{exame}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Etapa 3: Observações e Assinatura */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Observações do Atendimento / Evolução</label>
                                <textarea
                                    name="observacoes"
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                    placeholder="Relate os próximos passos terapêuticos, orientações repassadas ou intercorrências..."
                                    rows="4"
                                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm text-slate-700 w-full resize-y"
                                />
                            </div>
                        </div>

                        {/* Submit Action */}
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={salvando}
                                className="px-8 py-3.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 focus:ring-4 focus:ring-purple-500/30 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {salvando ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                {salvando ? 'Processando...' : 'Gravar Desfecho no Prontuário'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
