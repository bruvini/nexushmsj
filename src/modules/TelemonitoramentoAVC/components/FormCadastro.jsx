import { useState } from 'react';
import { toast } from 'react-toastify';
import { savePaciente } from '../services/avcService';

export default function FormCadastro() {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        dataNascimento: '',
        prontuario: '',
        telefone: '',
        cpf: '',
        profissionalResponsavel: '',
        elegivelMonitoramento: true,
        motivoInelegibilidade: ''
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!formData.elegivelMonitoramento && !formData.motivoInelegibilidade.trim()) {
            toast.error('Informe o motivo da inelegibilidade.');
            setLoading(false);
            return;
        }

        const { success, error } = await savePaciente(formData);

        if (success) {
            toast.success('Paciente cadastrado com sucesso!');
            setFormData({
                nome: '',
                dataNascimento: '',
                prontuario: '',
                telefone: '',
                cpf: '',
                profissionalResponsavel: '',
                elegivelMonitoramento: true,
                motivoInelegibilidade: ''
            });
        } else {
            toast.error('Erro ao salvar paciente. ' + (error?.message || ''));
        }
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl mx-auto">
            <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Novo Paciente (Triagem)</h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Cadastro primário e definição de elegibilidade para a linha de cuidado pós-AVC.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Nome Completo <span className="text-red-500">*</span></label>
                        <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Nome do Paciente" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Data de Nascimento <span className="text-red-500">*</span></label>
                        <input required type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">CPF <span className="text-red-500">*</span></label>
                        <input required type="text" name="cpf" value={formData.cpf} onChange={handleChange} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="000.000.000-00" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Prontuário <span className="text-red-500">*</span></label>
                        <input required type="text" name="prontuario" value={formData.prontuario} onChange={handleChange} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Apenas números" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Telefone <span className="text-red-500">*</span></label>
                        <input required type="tel" name="telefone" value={formData.telefone} onChange={handleChange} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="(00) 00000-0000" />
                    </div>

                    <div className="flex flex-col gap-2 lg:col-span-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Responsável/Triador <span className="text-red-500">*</span></label>
                        <input required type="text" name="profissionalResponsavel" value={formData.profissionalResponsavel} onChange={handleChange} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Nome do Triador" />
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                        <input type="checkbox" id="elegivel" name="elegivelMonitoramento" checked={formData.elegivelMonitoramento} onChange={handleChange} className="w-5 h-5 text-sky-500 bg-slate-50 border-slate-300 rounded focus:ring-sky-500 focus:ring-2 transition-all cursor-pointer" />
                        <label htmlFor="elegivel" className="text-sm font-medium text-slate-700 cursor-pointer">Paciente ELEGÍVEL para a linha de cuidado e fluxo de exames</label>
                    </div>

                    {!formData.elegivelMonitoramento && (
                        <div className="flex flex-col gap-2 mt-4 animate-fadeIn">
                            <label className="text-xs font-semibold text-red-500 uppercase tracking-wider">Motivo da Inelegibilidade <span className="text-red-500">*</span></label>
                            <textarea name="motivoInelegibilidade" value={formData.motivoInelegibilidade} onChange={handleChange} rows="3" className="px-4 py-3 bg-red-50/50 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all text-sm text-slate-700 w-full resize-none" placeholder="Ex: Mudou de município, recusa do paciente, não se enquadra no protocolo (comorbidades avançadas, etc)."></textarea>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="px-6 py-2.5 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 focus:ring-4 focus:ring-sky-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-sky-500/20">
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
                        {loading ? 'Salvando...' : 'Salvar e Registrar'}
                    </button>
                </div>
            </form>
        </div>
    );
}
