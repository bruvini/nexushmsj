import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getPendingAcolhimento, saveAcolhimento, getAVCConfigs } from '../services/avcService';

export default function FormAcolhimento() {
    const [loading, setLoading] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [pacientesPendentes, setPacientesPendentes] = useState([]);
    const [selectedPacienteId, setSelectedPacienteId] = useState('');

    const [medicacoesCadastradas, setMedicacoesCadastradas] = useState([]);

    const initialState = {
        elegivel_monitoramento: 'SIM',
        motivo_inelegibilidade: '',
        dataInternacao: '',
        prontuario: '',
        telefone1: '',
        telefone2: '',
        cidade: '',
        fazUsoAnticoagulante: 'NÃO',
        anticoagulantes_utilizados: []
    };

    const [formData, setFormData] = useState(initialState);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoadingInitial(true);

        // Busca pacientes pendentes
        const pRes = await getPendingAcolhimento();
        if (pRes.success) {
            setPacientesPendentes(pRes.data);
        }

        // Busca configurações clínicas (para a lista de Anticoagulantes)
        const cRes = await getAVCConfigs();
        if (cRes.success) {
            setMedicacoesCadastradas(cRes.data.medicacoes || []);
        }

        setLoadingInitial(false);
    };

    const handlePacienteChange = (e) => {
        const pId = e.target.value;
        setSelectedPacienteId(pId);

        if (pId) {
            const paciente = pacientesPendentes.find(p => p.id === pId);
            // Pré-preenche alguns dados se já existirem na base
            setFormData(prev => ({
                ...initialState, // Reseta form antes de preencher
                prontuario: paciente?.prontuario || '',
                telefone1: paciente?.telefone || '',
            }));
        } else {
            setFormData(initialState);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleMedicacaoToggle = (med) => {
        setFormData(prev => {
            const isSelected = prev.anticoagulantes_utilizados.includes(med);
            return {
                ...prev,
                anticoagulantes_utilizados: isSelected
                    ? prev.anticoagulantes_utilizados.filter(m => m !== med)
                    : [...prev.anticoagulantes_utilizados, med]
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPacienteId) {
            toast.warning('Selecione um paciente para o acolhimento.');
            return;
        }

        if (formData.elegivel_monitoramento === 'NÃO' && !formData.motivo_inelegibilidade.trim()) {
            toast.error('Informe o motivo da inelegibilidade.');
            return;
        }

        setLoading(true);

        const { success, error } = await saveAcolhimento(selectedPacienteId, formData);

        if (success) {
            toast.success('Acolhimento registrado com sucesso!');
            setFormData(initialState);
            setSelectedPacienteId('');
            // Atualiza lista removendo o que acabou de ser feito
            fetchInitialData();
        } else {
            toast.error('Erro ao salvar acolhimento. ' + (error?.message || ''));
        }

        setLoading(false);
    };

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-[#8e44ad]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando dados da triagem...
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl mx-auto animate-fadeIn">
            <div className="mb-8 border-b border-slate-100 pb-4 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Acolhimento Clínico</h2>
                    <p className="text-sm text-slate-500 mt-1 font-light">Efetivação do cadastro e checklist primário.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Seleção do Paciente */}
                <div className="bg-[#8e44ad]/5 p-5 rounded-xl border border-[#8e44ad]/20 mb-6">
                    <label className="text-[11px] font-semibold text-[#8e44ad] uppercase tracking-wider mb-2 block">
                        Selecione o Paciente Aguardando Acolhimento
                    </label>

                    {pacientesPendentes.length === 0 ? (
                        <div className="p-4 bg-white border border-[#8e44ad]/10 rounded-lg text-sm text-slate-500 italic text-center text-[#8e44ad]">
                            Nenhum paciente aguardando etapa de acolhimento nesta célula.
                        </div>
                    ) : (
                        <select
                            value={selectedPacienteId}
                            onChange={handlePacienteChange}
                            className="w-full px-4 py-3 bg-white border border-[#8e44ad]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8e44ad] transition-all text-sm text-slate-700 font-medium cursor-pointer"
                        >
                            <option value="">-- Clique aqui para selecionar --</option>
                            {pacientesPendentes.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nome} (Elegível na Triagem: {p.elegivelMonitoramento ? 'Sim' : 'Não'})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {selectedPacienteId && (
                    <div className="animate-fadeIn space-y-6">

                        {/* Decisão de Elegibilidade Real */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                                <h3 className="text-sm font-semibold text-slate-700">Mantém Elegibilidade Operacional?</h3>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" name="elegivel_monitoramento" value="SIM" checked={formData.elegivel_monitoramento === 'SIM'} onChange={handleChange} className="w-4 h-4 text-[#8e44ad] focus:ring-[#8e44ad] border-slate-300" />
                                        <span className="text-sm text-slate-700 font-medium group-hover:text-[#8e44ad]">SIM</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" name="elegivel_monitoramento" value="NÃO" checked={formData.elegivel_monitoramento === 'NÃO'} onChange={handleChange} className="w-4 h-4 text-[#8e44ad] focus:ring-[#8e44ad] border-slate-300" />
                                        <span className="text-sm text-slate-700 font-medium group-hover:text-[#8e44ad]">NÃO</span>
                                    </label>
                                </div>
                            </div>

                            {formData.elegivel_monitoramento === 'NÃO' && (
                                <div className="flex flex-col gap-2 mt-4 animate-fadeIn">
                                    <label className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Motivo de Desligamento <span className="text-red-500">*</span></label>
                                    <textarea name="motivo_inelegibilidade" value={formData.motivo_inelegibilidade} onChange={handleChange} rows="3" className="px-4 py-3 bg-red-50/50 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all text-sm text-slate-700 w-full resize-none shadow-inner" placeholder="Especifique o motivo clínico ou administrativo. A linha de cuidado será encerrada para este paciente."></textarea>
                                </div>
                            )}

                            {formData.elegivel_monitoramento === 'SIM' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 animate-fadeIn">
                                    <div className="flex flex-col gap-2 lg:col-span-1">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Prontuário <span className="text-red-500">*</span></label>
                                        <input required type="text" name="prontuario" value={formData.prontuario} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8e44ad] focus:border-[#8e44ad] transition-all text-sm text-slate-700" />
                                    </div>

                                    <div className="flex flex-col gap-2 lg:col-span-1">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data Internação <span className="text-red-500">*</span></label>
                                        <input required type="date" name="dataInternacao" value={formData.dataInternacao} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8e44ad] focus:border-[#8e44ad] transition-all text-sm text-slate-700" />
                                    </div>

                                    <div className="flex flex-col gap-2 lg:col-span-2">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cidade Residente <span className="text-red-500">*</span></label>
                                        <input required type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8e44ad] focus:border-[#8e44ad] transition-all text-sm text-slate-700" placeholder="Ex: Joinville, SC" />
                                    </div>

                                    <div className="flex flex-col gap-2 lg:col-span-2">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telefone Principal (Acolhimento) <span className="text-red-500">*</span></label>
                                        <input required type="tel" name="telefone1" value={formData.telefone1} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8e44ad] focus:border-[#8e44ad] transition-all text-sm text-slate-700" placeholder="(00) 00000-0000" />
                                    </div>

                                    <div className="flex flex-col gap-2 lg:col-span-2">
                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Telefone Cônjuge/Familiar</label>
                                        <input type="tel" name="telefone2" value={formData.telefone2} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8e44ad] focus:border-[#8e44ad] transition-all text-sm text-slate-700" placeholder="(Opcional)" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Anticoagulantes */}
                        {formData.elegivel_monitoramento === 'SIM' && (
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 animate-fadeIn">
                                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                                    <h3 className="text-sm font-semibold text-slate-700">Faz uso de Anticoagulante?</h3>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="fazUsoAnticoagulante" value="SIM" checked={formData.fazUsoAnticoagulante === 'SIM'} onChange={handleChange} className="w-4 h-4 text-[#8e44ad] focus:ring-[#8e44ad] border-slate-300" />
                                            <span className="text-sm text-slate-700 font-medium group-hover:text-[#8e44ad]">SIM</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="fazUsoAnticoagulante" value="NÃO" checked={formData.fazUsoAnticoagulante === 'NÃO'} onChange={handleChange} className="w-4 h-4 text-[#8e44ad] focus:ring-[#8e44ad] border-slate-300" />
                                            <span className="text-sm text-slate-700 font-medium group-hover:text-[#8e44ad]">NÃO</span>
                                        </label>
                                    </div>
                                </div>

                                {formData.fazUsoAnticoagulante === 'SIM' && (
                                    <div className="mt-4 p-4 border border-slate-200 rounded-lg bg-white shadow-sm animate-fadeIn">
                                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase mb-3 tracking-wider">Selecione as Medicações</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {medicacoesCadastradas.map(med => (
                                                <label key={med} className="flex items-start gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.anticoagulantes_utilizados.includes(med)}
                                                        onChange={() => handleMedicacaoToggle(med)}
                                                        className="w-4 h-4 mt-0.5 text-[#8e44ad] bg-slate-50 border-slate-300 rounded focus:ring-[#8e44ad] transition-all"
                                                    />
                                                    <span className="text-xs text-slate-600 font-medium group-hover:text-[#8e44ad] leading-tight">{med}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {medicacoesCadastradas.length === 0 && (
                                            <p className="text-xs text-amber-600 italic">Nenhum anticoagulante cadastrado. Acesse a área de Configurações para adicionar.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-slate-100 mt-8">
                            <button
                                type="submit"
                                disabled={loading || !selectedPacienteId}
                                className="px-8 py-3 bg-[#8e44ad] text-white text-sm font-semibold rounded-lg hover:bg-[#732d91] focus:ring-4 focus:ring-[#8e44ad]/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/20 w-full md:w-auto justify-center"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                Registrar Acolhimento
                            </button>
                        </div>

                    </div>
                )}
            </form>
        </div>
    );
}
