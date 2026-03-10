import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { savePatient, checkPatientDuplicity, getInitialConfigs, updateConfigList } from '../services/avcService';

export default function FormCadastro() {
    const [loading, setLoading] = useState(false);
    const [loadingConfigs, setLoadingConfigs] = useState(true);
    const [examesDisponiveis, setExamesDisponiveis] = useState([]);

    // Novo Exame On-the-fly
    const [showNewExameInput, setShowNewExameInput] = useState(false);
    const [novoExameTexto, setNovoExameTexto] = useState('');

    // Controle do Modal de Duplicidade
    const [showDuplicityModal, setShowDuplicityModal] = useState(false);
    const [duplicatedPatients, setDuplicatedPatients] = useState([]);

    const initialState = {
        nome: '',
        dataNascimento: '',
        idade: '',
        profissionalResponsavel: '',
        status: 'Internado', // 'Internado' | 'Alta'
        setor: '',
        leito: '',
        data_alta_hospitalar: '',
        data_inclusao: '',
        data_provavel_alta: '',
        elegivelMonitoramento: true,
        motivoInelegibilidade: '',
        examesMarcados: []
    };

    const [formData, setFormData] = useState(initialState);

    useEffect(() => {
        const fetchConfigs = async () => {
            const { success, configs } = await getInitialConfigs();
            if (success) {
                setExamesDisponiveis(configs.exames || []);
            }
            setLoadingConfigs(false);
        };
        fetchConfigs();
    }, []);

    const calcularIdade = (dataNascimento) => {
        if (!dataNascimento) return '';
        const hoje = new Date();
        const nascimento = new Date(dataNascimento);
        let idadeCalculada = hoje.getFullYear() - nascimento.getFullYear();
        const m = hoje.getMonth() - nascimento.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
            idadeCalculada--;
        }
        return idadeCalculada >= 0 ? idadeCalculada : 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'dataNascimento') {
            setFormData(prev => ({
                ...prev,
                dataNascimento: value,
                idade: calcularIdade(value)
            }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleExameToggle = (exame) => {
        setFormData(prev => {
            const isSelected = prev.examesMarcados.includes(exame);
            return {
                ...prev,
                examesMarcados: isSelected
                    ? prev.examesMarcados.filter(e => e !== exame)
                    : [...prev.examesMarcados, exame]
            };
        });
    };

    const handleBlurNomeDuplicates = async () => {
        if (formData.nome.trim().length > 3 && formData.dataNascimento) {
            const { success, isDuplicate, data } = await checkPatientDuplicity(formData.nome, formData.dataNascimento);
            if (success && isDuplicate) {
                setDuplicatedPatients(data);
                setShowDuplicityModal(true);
            }
        }
    };

    const handleAdicionarExame = async () => {
        const exame = novoExameTexto.trim().toUpperCase();
        if (!exame) {
            setShowNewExameInput(false);
            return;
        }

        if (examesDisponiveis.includes(exame)) {
            toast.warn('Este exame já está na lista.');
            return;
        }

        // Salvar localmente e no Firebase (on-the-fly)
        setExamesDisponiveis(prev => [...prev, exame]);
        setNovoExameTexto('');
        setShowNewExameInput(false);

        // Atualizar lista de marcados do paciente atual com o novo exame
        setFormData(prev => ({
            ...prev,
            examesMarcados: [...prev.examesMarcados, exame]
        }));

        const { success } = await updateConfigList('exames', 'add', exame);
        if (success) {
            toast.success(`Exame "${exame}" adicionado à lista global!`);
        } else {
            toast.error('O exame foi usado localmente, mas houve erro ao salvar na nuvem.');
        }
    };

    const fecharModalDuplicidade = () => {
        setShowDuplicityModal(false);
        setDuplicatedPatients([]);
    };

    const handleDuplicityChoice = async (type) => {
        // type: 'reinternacao' | 'novo'
        fecharModalDuplicidade();
        await processSubmit(type, duplicatedPatients[0]?.id);
    };

    const processSubmit = async (type = 'new', oldPatientId = null) => {
        setLoading(true);

        if (!formData.elegivelMonitoramento && !formData.motivoInelegibilidade.trim()) {
            toast.error('Informe o motivo da inelegibilidade.');
            setLoading(false);
            return;
        }

        const payload = {
            ...formData,
            status_monitoramento_atual: 'REALIZAR ACOLHIMENTO'
        };

        const { success, error } = await savePatient(payload, type, oldPatientId);

        if (success) {
            toast.success(type === 'reinternacao' ? 'Reinternação registrada com sucesso!' : 'Paciente cadastrado com sucesso!');
            setFormData(initialState);
        } else {
            toast.error('Erro ao salvar paciente. ' + (error?.message || ''));
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Verificação de segurança no submit caso o onBlur não tenha pego
        if (formData.nome && formData.dataNascimento) {
            const { success, isDuplicate, data } = await checkPatientDuplicity(formData.nome, formData.dataNascimento);
            if (success && isDuplicate) {
                setDuplicatedPatients(data);
                setShowDuplicityModal(true);
                return;
            }
        }

        await processSubmit('new');
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-5xl mx-auto relative relative">
            <div className="mb-8 border-b border-slate-100 pb-4 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Novo Paciente (Triagem)</h2>
                    <p className="text-sm text-slate-500 mt-1 font-light">Cadastro primário e definição de elegibilidade centralizada.</p>
                </div>
                {loadingConfigs && <span className="text-xs text-sky-500 animate-pulse font-medium">Carregando formulário...</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Pessoais */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 mb-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-200 pb-2">Dados Pessoais e Clínicos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-2 lg:col-span-2">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nome Completo <span className="text-red-500">*</span></label>
                            <input required type="text" name="nome" value={formData.nome} onChange={handleChange} onBlur={handleBlurNomeDuplicates} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Nome do Paciente" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nascimento <span className="text-red-500">*</span></label>
                            <input required type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} onBlur={handleBlurNomeDuplicates} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Idade</label>
                            <input type="text" readOnly value={formData.idade ? `${formData.idade} anos` : ''} className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-500 cursor-not-allowed" placeholder="Auto" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data da Solicitação Médica <span className="text-red-500">*</span></label>
                            <input required type="date" name="data_inclusao" value={formData.data_inclusao} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" />
                        </div>

                        <div className="flex flex-col gap-2 lg:col-span-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Responsável/Triador <span className="text-red-500">*</span></label>
                            <input required type="text" name="profissionalResponsavel" value={formData.profissionalResponsavel} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Seu Nome" />
                        </div>
                    </div>
                </div>

                {/* Status Hospitalar */}
                <div className="bg-sky-50/50 p-5 rounded-xl border border-sky-100 mb-6 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4 border-b border-sky-200/50 pb-2">
                        <h3 className="text-sm font-semibold text-sky-800">Status Hospitalar</h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="status" value="Internado" checked={formData.status === 'Internado'} onChange={handleChange} className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-slate-300" />
                                <span className="text-sm text-slate-700 font-medium">Internado</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="status" value="Alta" checked={formData.status === 'Alta'} onChange={handleChange} className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-slate-300" />
                                <span className="text-sm text-slate-700 font-medium">Alta</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                        {formData.status === 'Internado' && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Setor <span className="text-red-500">*</span></label>
                                    <input required type="text" name="setor" value={formData.setor} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Ex: UTI, Enfermaria" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Leito <span className="text-red-500">*</span></label>
                                    <input required type="text" name="leito" value={formData.leito} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700" placeholder="Ex: L-01" />
                                </div>
                                <div className="flex flex-col gap-2 md:col-span-2">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data Prevista de Alta</label>
                                    <input type="date" name="data_provavel_alta" value={formData.data_provavel_alta} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700 lg:w-1/2" />
                                </div>
                            </>
                        )}
                        {formData.status === 'Alta' && (
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data da Alta <span className="text-red-500">*</span></label>
                                <input required type="date" name="data_alta_hospitalar" value={formData.data_alta_hospitalar} onChange={handleChange} className="px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm text-slate-700 lg:w-1/2" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Elegibilidade e Exames */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <input type="checkbox" id="elegivel" name="elegivelMonitoramento" checked={formData.elegivelMonitoramento} onChange={handleChange} className="w-5 h-5 text-sky-500 bg-white border-slate-300 rounded focus:ring-sky-500 focus:ring-2 transition-all cursor-pointer" />
                        <label htmlFor="elegivel" className="text-sm font-semibold text-slate-700 cursor-pointer">Paciente ELEGÍVEL para Linha de Cuidado (Telemonitoramento)</label>
                    </div>

                    {formData.elegivelMonitoramento ? (
                        <div className="mt-4 p-5 border border-slate-200 rounded-xl bg-white shadow-sm animate-fadeIn">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase">Exames Solicitados/Realizados</h4>

                                {!showNewExameInput ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowNewExameInput(true)}
                                        className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-sky-50"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Novo Exame
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={novoExameTexto}
                                            onChange={(e) => setNovoExameTexto(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdicionarExame())}
                                            placeholder="NOME DO EXAME"
                                            className="px-2 py-1 text-xs border border-sky-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 uppercase"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAdicionarExame}
                                            className="text-white bg-sky-600 hover:bg-sky-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                                        >
                                            Salvar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewExameInput(false)}
                                            className="text-slate-500 hover:text-slate-700 px-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {examesDisponiveis.map(exame => (
                                    <label key={exame} className="flex items-start gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.examesMarcados.includes(exame)}
                                            onChange={() => handleExameToggle(exame)}
                                            className="w-4 h-4 mt-0.5 text-sky-600 bg-slate-50 border-slate-300 rounded focus:ring-sky-500 transition-all"
                                        />
                                        <span className="text-xs text-slate-600 font-medium group-hover:text-sky-700 leading-tight">{exame}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 mt-4 animate-fadeIn">
                            <label className="text-xs font-semibold text-red-500 uppercase tracking-wider">Motivo da Inelegibilidade <span className="text-red-500">*</span></label>
                            <textarea name="motivoInelegibilidade" value={formData.motivoInelegibilidade} onChange={handleChange} rows="3" className="px-4 py-3 bg-red-50/50 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all text-sm text-slate-700 w-full resize-none shadow-inner" placeholder="Especifique o motivo clínico ou administrativo (Ex: Óbito, Cuidados Paliativos)."></textarea>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-200 mt-8">
                    <button type="submit" disabled={loading} className="px-8 py-3 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 focus:ring-4 focus:ring-sky-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-sky-500/20 w-full md:w-auto justify-center">
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
                        {loading ? 'Processando...' : 'Cadastrar paciente'}
                    </button>
                </div>
            </form>

            {/* MODAL DE DUPLICIDADE */}
            {showDuplicityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
                        <div className="p-6 border-b border-slate-100 bg-amber-50/50">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
                                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-bold text-slate-900 text-center">Registro Duplicado Detectado</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 text-center mb-6">
                                Já existe um paciente cadastrado com o nome <strong>{formData.nome}</strong> e data de nascimento <strong>{formData.dataNascimento}</strong>. O que deseja fazer?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => handleDuplicityChoice('reinternacao')} className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition-colors">
                                    Sim, é uma Reinternação
                                </button>
                                <button onClick={() => handleDuplicityChoice('novo')} className="w-full flex justify-center items-center px-4 py-3 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-colors">
                                    Ignorar e Criar Novo Monitoramento
                                </button>
                                <button onClick={fecharModalDuplicidade} className="w-full flex justify-center items-center pt-2 text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                                    Cancelar Operação
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
