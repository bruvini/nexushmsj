import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getAVCConfigs, updateConfigList } from '../services/avcService';

export default function ConfiguracoesAVC() {
    const [loading, setLoading] = useState(true);
    const [configs, setConfigs] = useState({ exames: [], medicacoes: [], emails: [] });

    const [newExame, setNewExame] = useState('');
    const [newMedicacao, setNewMedicacao] = useState('');
    const [newEmail, setNewEmail] = useState('');

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        const { success, data } = await getAVCConfigs();
        if (success) {
            setConfigs(data);
        } else {
            toast.error('Erro ao carregar configurações.');
        }
        setLoading(false);
    };

    const handleAction = async (tipo, acao, valor, resetInputFn) => {
        if (acao === 'add' && !valor.trim()) return;

        // Converte para uppercase apenas se não for e-mail
        const finalValue = tipo === 'emails' ? valor.trim() : valor.trim().toUpperCase();

        // Impede duplicados no frontend antes mesmo de ir pro Firebase
        if (acao === 'add' && configs[tipo]?.includes(finalValue)) {
            toast.warn(`"${finalValue}" já existe na lista.`);
            return;
        }

        const { success } = await updateConfigList(tipo, acao, finalValue);
        if (success) {
            toast.success(`${tipo === 'emails' ? 'E-mail' : tipo === 'exames' ? 'Exame' : 'Anticoagulante'} ${acao === 'add' ? 'adicionado' : 'removido'} com sucesso!`);
            if (acao === 'add' && resetInputFn) {
                resetInputFn('');
            }
            fetchConfigs(); // Recarrega os dados do Firestore
        } else {
            toast.error('Ação falhou.');
        }
    };

    const ConfigPanel = ({ title, description, tipo, value, setValue, items, icon }) => (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full relative overflow-hidden group hover:border-[#8e44ad]/30 transition-colors duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-[#8e44ad] transition-colors"></div>

            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[#8e44ad]">
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">{title}</h3>
                    <p className="text-xs text-slate-500 font-medium">{description}</p>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                <input
                    type={tipo === 'emails' ? 'email' : 'text'}
                    value={value}
                    onChange={(e) => tipo === 'emails' ? setValue(e.target.value) : setValue(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8e44ad]/50 text-sm text-slate-700 placeholder-slate-400"
                    placeholder={tipo === 'emails' ? "exemplo@hmsj.sc.gov.br" : "DIGITE AQUI..."}
                    onKeyPress={(e) => e.key === 'Enter' && handleAction(tipo, 'add', value, setValue)}
                />
                <button
                    onClick={() => handleAction(tipo, 'add', value, setValue)}
                    className="px-4 py-2 bg-[#8e44ad] hover:bg-[#732d91] text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center shadow-md shadow-purple-500/20"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[150px] border border-slate-100 rounded-lg bg-slate-50/50 p-2">
                {items && items.length > 0 ? (
                    <ul className="space-y-2">
                        {items.map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between text-sm bg-white border border-slate-200 px-3 py-2 rounded-md shadow-sm">
                                <span className="text-slate-700 font-medium">{item}</span>
                                <button
                                    onClick={() => handleAction(tipo, 'remove', item)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                    title="Remover"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-light italic">
                        Nenhum registro encontrado.
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando configurações...
                </span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-fadeIn pb-12">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Parametrização Clínica</h2>
                <p className="text-sm text-slate-500 mt-1 font-light">Gerencie os dicionários de dados dinâmicos utilizados no módulo de Telemonitoramento.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ConfigPanel
                    title="E-mails (Notificações)"
                    description="Destinatários para alertas graves"
                    tipo="emails"
                    value={newEmail}
                    setValue={setNewEmail}
                    items={configs.emails}
                    icon={(
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    )}
                />
                <ConfigPanel
                    title="Dicionário de Exames"
                    description="Exames listados na Triagem e Checagem"
                    tipo="exames"
                    value={newExame}
                    setValue={setNewExame}
                    items={configs.exames}
                    icon={(
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    )}
                />
                <ConfigPanel
                    title="Anticoagulantes"
                    description="Medicações avaliadas no Acolhimento"
                    tipo="medicacoes"
                    value={newMedicacao}
                    setValue={setNewMedicacao}
                    items={configs.medicacoes}
                    icon={(
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    )}
                />
            </div>
        </div>
    );
}
