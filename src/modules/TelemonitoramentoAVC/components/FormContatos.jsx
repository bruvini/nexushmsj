import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getPatientsForCRM, saveContact } from '../services/avcService';

export default function FormContatos() {
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [pacientes, setPacientes] = useState([]);
    const [pacienteAtivo, setPacienteAtivo] = useState(null);
    const [salvando, setSalvando] = useState(false);

    // Form settings
    const [meioContato, setMeioContato] = useState('Ligação');
    const [horaInicio, setHoraInicio] = useState('');
    const [horaFim, setHoraFim] = useState('');
    const [resultado, setResultado] = useState('');
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoadingInitial(true);
        const pRes = await getPatientsForCRM();
        if (pRes.success) {
            setPacientes(pRes.data);
        }
        setLoadingInitial(false);
    };

    const handlePacienteChange = (e) => {
        const pId = e.target.value;
        if (pId) {
            const paciente = pacientes.find(p => p.id === pId);
            setPacienteAtivo(paciente);
        } else {
            setPacienteAtivo(null);
        }
        // Resets
        setMeioContato('Ligação');
        setHoraInicio('');
        setHoraFim('');
        setResultado('');
        setObservacoes('');
    };

    const setTimeToNow = (field) => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;
        if (field === 'inicio') setHoraInicio(timeStr);
        if (field === 'fim') setHoraFim(timeStr);
    };

    const handleMeioContatoChange = (e) => {
        setMeioContato(e.target.value);
        setResultado(''); // Reset result on medium change
    };

    const getResultadoOptions = () => {
        if (meioContato === 'Ligação') {
            return ['Atendeu', 'Não Atendeu', 'Caixa Postal', 'Número Inexistente'];
        }
        if (meioContato === 'WhatsApp') {
            return ['Mensagem Enviada', 'Respondido', 'Visualizado (Sem Resposta)', 'Bloqueado/Sem WhatsApp'];
        }
        if (meioContato === 'Presencial') {
            return ['Atendimento Concluído', 'Paciente Ausente'];
        }
        return [];
    };

    const calculateDuration = () => {
        if (!horaInicio || !horaFim) return 0;
        const [h1, m1] = horaInicio.split(':').map(Number);
        const [h2, m2] = horaFim.split(':').map(Number);

        const d1 = new Date(); d1.setHours(h1, m1, 0, 0);
        const d2 = new Date(); d2.setHours(h2, m2, 0, 0);

        let diffMs = d2 - d1;
        // If end time is conceptually lower/before start time within 24hr loop
        if (diffMs < 0) {
            d2.setDate(d2.getDate() + 1);
            diffMs = d2 - d1;
        }

        const mins = Math.round(diffMs / 60000);
        return mins;
    };

    const gerarLinkWhatsApp = (numero) => {
        if (!numero) return '';
        const numeroLimpo = numero.replace(/\D/g, ''); // Limpa tudo que não for número
        return `https://wa.me/55${numeroLimpo}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!resultado) {
            toast.warn('Selecione o resultado/desfecho do contato.');
            return;
        }

        if (!horaInicio) {
            toast.warn('Preencha a Hora de Início.');
            return;
        }

        if (!horaFim) {
            toast.warn('Preencha a Hora de Fim.');
            return;
        }

        setSalvando(true);

        const duracao = calculateDuration();

        const contactData = {
            id_paciente: pacienteAtivo.id,
            meio_contato: meioContato,
            hora_inicio: horaInicio,
            hora_fim: horaFim,
            duracao_minutos: duracao,
            categoria_desfecho: resultado,
            observacoes: observacoes
        };

        const res = await saveContact(contactData);

        if (res.success) {
            toast.success(`Contato registrado com sucesso! (Duração: ${duracao} min)`);
            setPacienteAtivo(null);
            document.getElementById("paciente_select_crm").value = "";
            setHoraInicio('');
            setHoraFim('');
            setResultado('');
            setObservacoes('');
        } else {
            toast.error('Ocorreu um erro ao salvar o contato.');
        }

        setSalvando(false);
    };

    if (loadingInitial) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="text-slate-400 flex items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando fila de pacientes para contato...
                </span>
            </div>
        );
    }

    const duracaoMins = calculateDuration();

    return (
        <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-5xl mx-auto animate-fadeIn min-h-[500px]">
            <div className="mb-8 border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Central de Contato (CRM)</h2>
                    <p className="text-sm text-slate-500 mt-1 font-light">Registro de interações com o paciente via Telefone, WhatsApp ou Presencial.</p>
                </div>
            </div>

            {/* 
                @TODO [FASE 5 - Renderização Timeline de Auditoria]: 
                O paciente ativo abaixo deverá mapear seus contatos herdados e recém-criados. 
                A query aponta para `nexus_avc_contatos` via `where("pacienteId", "==", pacienteAtivo.id)`
                Os retornos deverão ser renderizados visualmente como uma timeline ordenada descrescentemente por:
                `orderBy('data_contato_manual', 'desc')` e `orderBy('dh_inicio', 'desc')`. 
            */}

            <div className="space-y-6">
                {/* Seletor de Paciente */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <label className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2 block">
                        Paciente Alvo (ativos: {pacientes.length})
                    </label>

                    <select
                        id="paciente_select_crm"
                        onChange={handlePacienteChange}
                        className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-slate-700 font-medium cursor-pointer"
                    >
                        <option value="">-- Selecione o Paciente para Contactar --</option>
                        {pacientes.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.nome} ({p.status_monitoramento_atual})
                            </option>
                        ))}
                    </select>
                </div>

                {pacienteAtivo && (
                    <div className="animate-fadeIn space-y-6">

                        {/* Telefones do Paciente */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">
                                Telefones de Contato
                            </h3>

                            {pacienteAtivo.telefones && pacienteAtivo.telefones.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {pacienteAtivo.telefones.map((tel, idx) => (
                                        <div key={idx} className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-4 py-2 gap-3 shadow-sm hover:border-emerald-300 transition-colors">
                                            <span className="text-sm text-slate-700 font-medium">{tel}</span>
                                            <a
                                                href={gerarLinkWhatsApp(tel)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center bg-[#25D366] text-white rounded-full w-8 h-8 hover:bg-[#1ebd5a] transition-colors shadow-md shadow-[#25D366]/30"
                                                title="Abrir no WhatsApp"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic">Nenhum telefone cadastrado para o paciente.</p>
                            )}
                        </div>

                        {/* Formulário do Contato */}
                        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Meio de Contato */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Meio de Contato <span className="text-red-500">*</span></label>
                                    <select
                                        value={meioContato}
                                        onChange={handleMeioContatoChange}
                                        className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-slate-700"
                                    >
                                        <option value="Ligação">Ligação (Telefonia)</option>
                                        <option value="WhatsApp">WhatsApp (Mensagem)</option>
                                        <option value="Presencial">Presencial / Clínico</option>
                                    </select>
                                </div>

                                {/* Resultado / Desfecho */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resultado da Tentativa <span className="text-red-500">*</span></label>
                                    <select
                                        value={resultado}
                                        onChange={(e) => setResultado(e.target.value)}
                                        className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-slate-700"
                                    >
                                        <option value="">-- Selecione o Desfecho --</option>
                                        {getResultadoOptions().map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Horários (AGORA) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end bg-slate-50 p-4 border border-slate-100 rounded-xl">
                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora Início <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={horaInicio}
                                            onChange={e => setHoraInicio(e.target.value)}
                                            className="px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-slate-700 w-full"
                                        />
                                        <button type="button" onClick={() => setTimeToNow('inicio')} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors">
                                            AGORA
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora Fim <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={horaFim}
                                            onChange={e => setHoraFim(e.target.value)}
                                            className="px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-slate-700 w-full"
                                        />
                                        <button type="button" onClick={() => setTimeToNow('fim')} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors">
                                            AGORA
                                        </button>
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-2 lg:col-span-2 flex items-center justify-end">
                                    {horaInicio && horaFim && (
                                        <div className="px-4 py-2 bg-emerald-100 border border-emerald-200 rounded-lg shadow-sm">
                                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Duração Calculada: </span>
                                            <span className={`text-sm font-bold ml-1 ${duracaoMins > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{duracaoMins} min</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Observações */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Anotações do Contato (Histórico)</label>
                                <textarea
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                    placeholder="Detalhes que precisam ir para o prontuário: paciente queixou-se de XYZ..."
                                    rows="3"
                                    className="px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm text-slate-700 w-full resize-y"
                                />
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="px-8 py-3.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/30 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {salvando ? 'Processando...' : 'Salvar Registro no CRM'}
                                </button>
                            </div>

                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
