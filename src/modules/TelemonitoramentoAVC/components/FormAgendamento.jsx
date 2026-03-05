import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getAgendamentoPatients, getAppointmentByPatient, countDailyAppointments, saveAppointment } from '../services/avcService';

export default function FormAgendamento() {
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [pacientes, setPacientes] = useState([]);
    const [selectedPacienteId, setSelectedPacienteId] = useState('');
    const [selectedPacienteName, setSelectedPacienteName] = useState('');
    const [selectedPacienteStatus, setSelectedPacienteStatus] = useState('');

    const [consultaAtual, setConsultaAtual] = useState(null);
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [salvando, setSalvando] = useState(false);

    const [formData, setFormData] = useState({
        data_agendamento: '',
        hora_agendamento: '',
        modalidade: 'Telemedicina',
        observacoes: ''
    });

    const [lotacao, setLotacao] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoadingInitial(true);
        const pRes = await getAgendamentoPatients();
        if (pRes.success) {
            setPacientes(pRes.data);
        }
        setLoadingInitial(false);
    };

    const handlePacienteChange = async (e) => {
        const pId = e.target.value;
        setSelectedPacienteId(pId);
        setConsultaAtual(null);
        setLotacao(null);
        setFormData({ data_agendamento: '', hora_agendamento: '', modalidade: 'Telemedicina', observacoes: '' });

        if (pId) {
            const paciente = pacientes.find(p => p.id === pId);
            setSelectedPacienteName(paciente?.nome || '');
            setSelectedPacienteStatus(paciente?.status_monitoramento_atual || '');

            setLoadingConsulta(true);
            const res = await getAppointmentByPatient(pId);
            if (res.success && res.data) {
                setConsultaAtual(res.data);
                setFormData({
                    data_agendamento: res.data.data_agendamento || '',
                    hora_agendamento: res.data.hora_agendamento || '',
                    modalidade: res.data.modalidade || 'Telemedicina',
                    observacoes: res.data.observacoes || ''
                });
                if (res.data.data_agendamento) {
                    checkLotacao(res.data.data_agendamento);
                }
            }
            setLoadingConsulta(false);
        } else {
            setSelectedPacienteName('');
            setSelectedPacienteStatus('');
        }
    };

    const checkLotacao = async (date) => {
        if (!date) {
            setLotacao(null);
            return;
        }
        const res = await countDailyAppointments(date);
        if (res.success) {
            setLotacao(res.count);
        }
    };

    const handleDataChange = (e) => {
        const novaData = e.target.value;
        setFormData(prev => ({ ...prev, data_agendamento: novaData }));
        checkLotacao(novaData);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAction = async (action) => {
        if (!selectedPacienteId) return;

        if (action !== 'CANCELAR' && (!formData.data_agendamento || !formData.hora_agendamento)) {
            toast.warn('Preencha a data e a hora do agendamento.');
            return;
        }

        setSalvando(true);

        const appointmentData = {
            id: consultaAtual?.id,
            id_paciente: selectedPacienteId,
            nome_paciente: selectedPacienteName, // denormalization for easier querying if needed
            status_monitoramento_atual: selectedPacienteStatus, // so the service knows if it can advance properly
            ...formData
        };

        const res = await saveAppointment(appointmentData, action, 0);

        if (res.success) {
            let successMessage = 'Agendamento salvo com sucesso!';
            if (action === 'CONFIRMAR') successMessage = '🎉 Consulta confirmada! Paciente movido para Desfecho.';
            if (action === 'CANCELAR') successMessage = 'Consulta cancelada. Status revertido.';

            toast.success(successMessage);

            // Re-fetch pacientes to get updated statuses
            await fetchInitialData();

            // Clear selection to force user to pick again or show updated state
            setSelectedPacienteId('');
            setConsultaAtual(null);
        } else {
            toast.error('Erro ao salvar agendamento.');
        }

        setSalvando(false);
    };

    const isExamesBloqueado = selectedPacienteStatus === 'VERIFICAR EXAMES';

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-sky-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando fila de agendamentos...
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-5xl mx-auto animate-fadeIn min-h-[500px] relative">
            <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Agendamento de Consulta</h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Coordenação do retorno ambulatorial com trava de lotação integrada.</p>
            </div>

            <div className="space-y-6">
                {/* Filtro do Paciente */}
                <div className="bg-sky-50/50 p-5 rounded-xl border border-sky-100 shadow-inner">
                    <label className="text-xs font-semibold text-sky-800 uppercase tracking-wider mb-2 block">
                        Selecione o Paciente para Agendamento
                    </label>

                    <select
                        value={selectedPacienteId}
                        onChange={handlePacienteChange}
                        className="w-full px-4 py-3 bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="">-- Clique aqui para selecionar --</option>
                        {pacientes.map(p => (
                            <option key={p.id} value={p.id}>{p.nome} ({p.status_monitoramento_atual})</option>
                        ))}
                    </select>
                </div>

                {selectedPacienteId && (
                    loadingConsulta ? (
                        <div className="h-40 bg-slate-50 rounded-xl animate-pulse border border-slate-100"></div>
                    ) : (
                        <div className="animate-fadeIn space-y-6">

                            {/* Status Box Reativo */}
                            {consultaAtual && (
                                <div className={`p-4 rounded-xl border flex items-center gap-3 ${consultaAtual.status === 'CONFIRMADO' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : (consultaAtual.status === 'PRE_AGENDADO' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800')}`}>
                                    <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {consultaAtual.status === 'CONFIRMADO' ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        )}
                                    </svg>
                                    <div>
                                        <p className="text-sm font-bold tracking-tight">Status Atual: {consultaAtual.status}</p>
                                        <p className="text-xs opacity-90">
                                            Agendado para {consultaAtual.data_agendamento} às {consultaAtual.hora_agendamento} ({consultaAtual.modalidade})
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Trava de Segurança HMSJ */}
                            {isExamesBloqueado && (
                                <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 text-red-700">
                                    <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-semibold">Bloqueado: Conclua os exames primeiro</p>
                                        <p className="text-xs mt-1">Este paciente ainda possui exames pendentes. Você pode "Pré-Agendar" para reservar a vaga, mas a confirmação oficial está travada pela Governança do HMSJ.</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                    {/* Data e Lotação */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Desejada <span className="text-red-500">*</span></label>
                                        <input
                                            type="date"
                                            name="data_agendamento"
                                            value={formData.data_agendamento}
                                            onChange={handleDataChange}
                                            className="px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700"
                                        />
                                        {lotacao !== null && formData.data_agendamento && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block w-max ${lotacao >= 5 ? 'bg-amber-100 text-amber-700' : (lotacao > 0 ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700')}`}>
                                                {lotacao > 0 ? `${lotacao} pacientes já agendados para este dia` : 'Data livre (0 pacientes)'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora <span className="text-red-500">*</span></label>
                                        <input
                                            type="time"
                                            name="hora_agendamento"
                                            value={formData.hora_agendamento}
                                            onChange={handleChange}
                                            className="px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modalidade <span className="text-red-500">*</span></label>
                                        <select
                                            name="modalidade"
                                            value={formData.modalidade}
                                            onChange={handleChange}
                                            className="px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700"
                                        >
                                            <option value="Telemedicina">Telemedicina</option>
                                            <option value="Presencial">Presencial</option>
                                            <option value="Visita Domiciliar">Visita Domiciliar</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Observações / Link do Meet</label>
                                        <input
                                            type="text"
                                            name="observacoes"
                                            value={formData.observacoes}
                                            onChange={handleChange}
                                            placeholder="Insira detalhes adicionais ou link para teleconsulta..."
                                            className="px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm text-slate-700 w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                {consultaAtual && consultaAtual.status !== 'CANCELADO' && (
                                    <button
                                        type="button"
                                        disabled={salvando}
                                        onClick={() => handleAction('CANCELAR')}
                                        className="px-4 py-2.5 bg-white border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancelar Agendamento
                                    </button>
                                )}

                                <button
                                    type="button"
                                    disabled={salvando}
                                    onClick={() => handleAction('PRE_AGENDAR')}
                                    className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                                >
                                    {salvando ? 'Salvando...' : 'Salvar como Pré-Agendado'}
                                </button>

                                <button
                                    type="button"
                                    disabled={salvando || isExamesBloqueado}
                                    onClick={() => handleAction('CONFIRMAR')}
                                    className="px-6 py-2.5 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 focus:ring-4 focus:ring-sky-500/30 transition-all shadow-md shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isExamesBloqueado && (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    )}
                                    Confirmar e Avançar Fase
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
