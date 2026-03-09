import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getAVCConfigs, updateConfigList, importarPacientesLoteCSV, importarExamesLoteCSV, importarConsultasLoteCSV, importarDesfechosLoteCSV, importarContatosLoteCSV } from '../services/avcService';

export default function ConfiguracoesAVC() {
    const [loading, setLoading] = useState(true);
    const [showModalMigracao, setShowModalMigracao] = useState(false);
    const [filePacientes, setFilePacientes] = useState(null);
    const [fileExames, setFileExames] = useState(null);
    const [fileConsultas, setFileConsultas] = useState(null);
    const [fileDesfechos, setFileDesfechos] = useState(null);
    const [fileContatos, setFileContatos] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);
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

    // =====================================
    // LÓGICA DE MIGRAÇÃO CSV (FILE READER)
    // =====================================
    // DD/MM/YYYY to YYYY-MM-DD
    const parseDate = (val) => {
        if (!val) return null;
        const clean = val.trim().replace(/^"|"$/g, '');
        if (clean.includes('/')) {
            const parts = clean.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return clean; // Fallback se for formato ISO
    };

    const handleMigracaoPacientes = async () => {
        return new Promise((resolve) => {
            if (!filePacientes) {
                resolve({ success: false, skipped: true });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                if (!text) {
                    toast.error('O arquivo de Pacientes está vazio.');
                    resolve({ success: false }); return;
                }

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    toast.error('O arquivo CSV de Pacientes parece não conter dados.');
                    resolve({ success: false }); return;
                }

                const headerLine = lines[0];
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
                const sanitizeString = (val) => val ? val.trim().replace(/^"|"$/g, '').toUpperCase() : '';

                const parsedData = [];

                for (let i = 1; i < lines.length; i++) {
                    const currentLine = lines[i].split(separator);
                    if (currentLine.length < headers.length - 2) continue;

                    const rowObj = {};
                    headers.forEach((h, index) => {
                        rowObj[h] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    try {
                        const baseObj = {
                            id_paciente: rowObj['id_paciente'] ? rowObj['id_paciente'].trim().replace(/^"|"$/g, '') : '',
                            nome: sanitizeString(rowObj['nome_paciente'] || rowObj['nome'] || ''),
                            prontuario: sanitizeString(rowObj['prontuario'] || ''),
                            data_nascimento: parseDate(rowObj['data_nascimento']),
                            sexo: sanitizeString(rowObj['sexo']),
                            telefone: sanitizeString(rowObj['telefone_principal'] || rowObj['telefone']),
                            telefone2: sanitizeString(rowObj['telefone2']),
                            telefone3: sanitizeString(rowObj['telefone3']),
                            cidade: sanitizeString(rowObj['cidade']),
                            setor: sanitizeString(rowObj['setor']),
                            leito: sanitizeString(rowObj['leito']),
                            status_monitoramento_atual: sanitizeString(rowObj['status_monitoramento_atual'] || rowObj['status'] || 'ENCERRADO - REINTERNAÇÃO'),
                            data_internacao_avc: parseDate(rowObj['data_internacao_avc']),
                            data_provavel_alta: parseDate(rowObj['data_provavel_alta']),
                            data_alta_hospitalar: parseDate(rowObj['data_alta_hospitalar']),
                            data_acolhimento: parseDate(rowObj['data_acolhimento']),
                            profissionalResponsavel: sanitizeString(rowObj['profissional_responsavel'] || rowObj['medico_solicitante']),
                        };

                        const strExames = (rowObj['lista_exames_iniciais'] || rowObj['examesMarcados'] || '').trim().replace(/^"|"$/g, '');
                        baseObj.examesMarcados = strExames ? strExames.split(',').map(s => s.trim().toUpperCase()).filter(s => s) : [];

                        const strAnti = (rowObj['detalhe_anticoagulante'] || rowObj['medicacao_alta'] || '').trim().replace(/^"|"$/g, '');
                        baseObj.medicacao_alta = strAnti ? strAnti.replace(/\+/g, ',').split(',').map(s => s.trim().toUpperCase()).filter(s => s) : [];

                        if (!baseObj.id_paciente) continue;
                        parsedData.push(baseObj);
                    } catch (err) {
                        console.error("Erro ao mapear linha de paciente:", i, err);
                    }
                }

                if (parsedData.length === 0) {
                    toast.error('Nenhum paciente válido encontrado no CSV.');
                    resolve({ success: false }); return;
                }

                const result = await importarPacientesLoteCSV(parsedData);
                resolve(result);
            };

            reader.onerror = () => {
                toast.error('Falha ao ler o arquivo CSV de Pacientes.');
                resolve({ success: false });
            };
            reader.readAsText(filePacientes, 'utf-8');
        });
    };

    const handleMigracaoExames = async () => {
        return new Promise((resolve) => {
            if (!fileExames) {
                resolve({ success: false, skipped: true });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                if (!text) {
                    toast.error('O arquivo de Exames está vazio.');
                    resolve({ success: false }); return;
                }

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    toast.error('O arquivo CSV de Exames parece não conter dados.');
                    resolve({ success: false }); return;
                }

                const headerLine = lines[0];
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
                const sanitizeString = (val) => val ? val.trim().replace(/^"|"$/g, '').toUpperCase() : '';

                const parsedData = [];
                let orphanosCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const currentLine = lines[i].split(separator);
                    if (currentLine.length < headers.length - 2) continue;

                    const rowObj = {};
                    headers.forEach((h, index) => {
                        rowObj[h] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    try {
                        const idPaciente = rowObj['id_paciente'] ? rowObj['id_paciente'].trim().replace(/^"|"$/g, '') : null;

                        // Validação Crítica (Vínculo)
                        if (!idPaciente) {
                            orphanosCount++;
                            continue;
                        }

                        let statusFormatado = sanitizeString(rowObj['status_exame'] || rowObj['status'] || 'PENDENTE');
                        if (statusFormatado === 'CONCLUIDO') statusFormatado = 'CONCLUÍDO';

                        const baseObj = {
                            id_exame: rowObj['id_exame'] ? rowObj['id_exame'].trim().replace(/^"|"$/g, '') : null,
                            id_paciente: idPaciente,
                            pacienteId: idPaciente, // duplicidade por conveniência FHIR legacy no service
                            nome_exame: sanitizeString(rowObj['nome_exame'] || rowObj['nome'] || 'EXAME INDEFINIDO'),
                            origem_solicitacao: sanitizeString(rowObj['origem_solicitacao'] || 'MIGRAÇÃO LEGADA'),
                            status_exame: statusFormatado,
                            status: statusFormatado, // Duplicidade para retrocompatibilidade
                            data_solicitacao: parseDate(rowObj['data_solicitacao']) || null,
                            data_checagem: parseDate(rowObj['data_checagem']) || null,
                            observacoes: sanitizeString(rowObj['observacoes'] || '')
                        };

                        parsedData.push(baseObj);
                    } catch (err) {
                        console.error("Erro ao mapear linha de exame:", i, err);
                    }
                }

                if (parsedData.length === 0) {
                    toast.error('Nenhum exame válido (com paciente) encontrado no CSV.');
                    resolve({ success: false }); return;
                }

                const result = await importarExamesLoteCSV(parsedData);
                if (result.success && orphanosCount > 0) {
                    result.orphanosCount = orphanosCount;
                }
                resolve(result);
            };

            reader.onerror = () => {
                toast.error('Falha ao ler o arquivo CSV de Exames.');
                resolve({ success: false });
            };
            reader.readAsText(fileExames, 'utf-8');
        });
    };

    const handleMigracaoConsultas = async () => {
        return new Promise((resolve) => {
            if (!fileConsultas) {
                resolve({ success: false, skipped: true });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                if (!text) {
                    toast.error('O arquivo de Consultas está vazio.');
                    resolve({ success: false }); return;
                }

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    toast.error('O arquivo CSV de Consultas parece não conter dados.');
                    resolve({ success: false }); return;
                }

                const headerLine = lines[0];
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
                const sanitizeString = (val) => val ? val.trim().replace(/^"|"$/g, '').toUpperCase() : '';

                const parsedData = [];
                let orphanosCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const currentLine = lines[i].split(separator);
                    if (currentLine.length < headers.length - 2) continue;

                    const rowObj = {};
                    headers.forEach((h, index) => {
                        rowObj[h] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    try {
                        const idPaciente = rowObj['id_paciente'] ? rowObj['id_paciente'].trim().replace(/^"|"$/g, '') : null;

                        // Validação Crítica (Vínculo)
                        if (!idPaciente) {
                            orphanosCount++;
                            continue;
                        }

                        // Formatação do timestamp para dh_ultima_atualizacao
                        const parseDateTime = (val) => {
                            if (!val) return null;
                            const clean = val.trim().replace(/^"|"$/g, '');
                            // Exemplo de formato vindo: 05/11/2024 14:30:00 ou similar
                            if (clean.includes('/') && clean.includes(':')) {
                                const [datePart, timePart] = clean.split(' ');
                                const dParts = datePart.split('/');
                                if (dParts.length === 3) {
                                    return `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}T${timePart}`;
                                }
                            }
                            return clean;
                        };

                        const baseObj = {
                            id_consulta: rowObj['id_consulta'] ? rowObj['id_consulta'].trim().replace(/^"|"$/g, '') : null,
                            pacienteId: idPaciente,
                            status_agendamento: sanitizeString(rowObj['status_agendamento'] || 'PRE-AGENDADO'),
                            data_pre_agendamento: parseDate(rowObj['data_pre_agendamento']) || null,
                            data_confirmada: parseDate(rowObj['data_confirmada']) || null,
                            dh_ultima_atualizacao: parseDateTime(rowObj['dh_ultima_atualizacao']) || null,
                            observacoes: sanitizeString(rowObj['observacoes'] || '')
                        };

                        parsedData.push(baseObj);
                    } catch (err) {
                        console.error("Erro ao mapear linha de consulta:", i, err);
                    }
                }

                if (parsedData.length === 0) {
                    toast.error('Nenhuma consulta válida (com paciente) encontrada no CSV.');
                    resolve({ success: false }); return;
                }

                const result = await importarConsultasLoteCSV(parsedData);
                if (result.success && orphanosCount > 0) {
                    result.orphanosCount = orphanosCount;
                }
                resolve(result);
            };

            reader.onerror = () => {
                toast.error('Falha ao ler o arquivo CSV de Consultas.');
                resolve({ success: false });
            };
            reader.readAsText(fileConsultas, 'utf-8');
        });
    };

    const handleMigracaoDesfechos = async () => {
        return new Promise((resolve) => {
            if (!fileDesfechos) {
                resolve({ success: false, skipped: true });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                if (!text) {
                    toast.error('O arquivo de Desfechos está vazio.');
                    resolve({ success: false }); return;
                }

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    toast.error('O arquivo CSV de Desfechos parece não conter dados.');
                    resolve({ success: false }); return;
                }

                const headerLine = lines[0];
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
                const sanitizeString = (val) => val ? val.trim().replace(/^"|"$/g, '').toUpperCase() : '';

                const parsedData = [];
                let orphanosCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const currentLine = lines[i].split(separator);
                    if (currentLine.length < headers.length - 2) continue;

                    const rowObj = {};
                    headers.forEach((h, index) => {
                        rowObj[h] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    try {
                        const idPaciente = rowObj['id_paciente'] ? rowObj['id_paciente'].trim().replace(/^"|"$/g, '') : null;

                        // Validação Crítica (Vínculo)
                        if (!idPaciente) {
                            orphanosCount++;
                            continue;
                        }

                        // Formatação do timestamp ISO Completo
                        const parseDateTime = (val) => {
                            if (!val) return null;
                            const clean = val.trim().replace(/^"|"$/g, '');
                            if (clean.includes('/') && clean.includes(':')) {
                                const [datePart, timePart] = clean.split(' ');
                                const dParts = datePart.split('/');
                                if (dParts.length === 3) {
                                    return `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}T${timePart}`;
                                }
                            }
                            return clean;
                        };

                        const baseObj = {
                            id_desfecho: rowObj['id_desfecho'] ? rowObj['id_desfecho'].trim().replace(/^"|"$/g, '') : null,
                            pacienteId: idPaciente,
                            consultaRefId: rowObj['id_consulta_ref'] ? rowObj['id_consulta_ref'].trim().replace(/^"|"$/g, '') : null,
                            tipo_desfecho: sanitizeString(rowObj['tipo_desfecho'] || 'OUTROS'),
                            dh_desfecho: parseDateTime(rowObj['dh_desfecho']) || null,
                            observacoes: rowObj['observacoes'] ? rowObj['observacoes'].trim().replace(/^"|"$/g, '') : ''
                        };

                        // Novos Exames => string com + virando Array
                        const strExames = (rowObj['novos_exames'] || '').trim().replace(/^"|"$/g, '');
                        baseObj.novos_exames = strExames ? strExames.replace(/\+/g, ',').split(',').map(s => s.trim().toUpperCase()).filter(s => s) : [];

                        parsedData.push(baseObj);
                    } catch (err) {
                        console.error("Erro ao mapear linha de desfecho:", i, err);
                    }
                }

                if (parsedData.length === 0) {
                    toast.error('Nenhum desfecho válido (com paciente) encontrado no CSV.');
                    resolve({ success: false }); return;
                }

                const result = await importarDesfechosLoteCSV(parsedData);
                if (result.success && orphanosCount > 0) {
                    result.orphanosCount = orphanosCount;
                }
                resolve(result);
            };

            reader.onerror = () => {
                toast.error('Falha ao ler o arquivo CSV de Desfechos.');
                resolve({ success: false });
            };
            reader.readAsText(fileDesfechos, 'utf-8');
        });
    };

    const handleMigracaoContatos = async () => {
        return new Promise((resolve) => {
            if (!fileContatos) {
                resolve({ success: false, skipped: true });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                if (!text) {
                    toast.error('O arquivo de Contatos está vazio.');
                    resolve({ success: false }); return;
                }

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    toast.error('O arquivo CSV de Contatos parece não conter dados.');
                    resolve({ success: false }); return;
                }

                const headerLine = lines[0];
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));

                const sanitizeString = (val) => val ? val.trim().replace(/^"|"$/g, '') : '';

                const parsedData = [];
                let orphanosCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const currentLine = lines[i].split(separator);
                    if (currentLine.length < headers.length - 2) continue;

                    const rowObj = {};
                    headers.forEach((h, index) => {
                        rowObj[h] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    try {
                        const idPaciente = rowObj['id_paciente'] ? rowObj['id_paciente'].trim().replace(/^"|"$/g, '') : null;

                        // Validação Crítica (Vínculo)
                        if (!idPaciente) {
                            orphanosCount++;
                            continue;
                        }

                        // Formatação `data_contato_manual` para YYYY-MM-DD
                        const parseDateISO = (val) => {
                            if (!val) return null;
                            const clean = val.trim().replace(/^"|"$/g, '');
                            if (clean.includes('/')) {
                                const [d, m, y] = clean.split(' ')[0].split('/');
                                if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                            }
                            return clean;
                        };

                        // Formatação `dh_registro` para ISO
                        const parseDateTime = (val) => {
                            if (!val) return null;
                            const clean = val.trim().replace(/^"|"$/g, '');
                            if (clean.includes('/') && clean.includes(':')) {
                                const [datePart, timePart] = clean.split(' ');
                                const dParts = datePart.split('/');
                                if (dParts.length === 3) {
                                    return `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}T${timePart}`;
                                }
                            }
                            return clean;
                        };

                        const baseObj = {
                            id_contato: rowObj['id_contato'] ? rowObj['id_contato'].trim().replace(/^"|"$/g, '') : null,
                            pacienteId: idPaciente,
                            meio_contato: sanitizeString(rowObj['meio_contato']),
                            categoria_desfecho: sanitizeString(rowObj['categoria_desfecho']),
                            dh_inicio: sanitizeString(rowObj['dh_inicio']) || null,
                            dh_fim: sanitizeString(rowObj['dh_fim']) || null,
                            data_contato_manual: parseDateISO(rowObj['data_contato_manual']),
                            dh_registro: parseDateTime(rowObj['dh_registro']),
                            observacao_detalhe: sanitizeString(rowObj['observacao_detalhe'])
                        };

                        parsedData.push(baseObj);
                    } catch (err) {
                        console.error("Erro ao mapear linha de contato:", i, err);
                    }
                }

                if (parsedData.length === 0) {
                    toast.error('Nenhum contato válido (com paciente) encontrado no CSV.');
                    resolve({ success: false }); return;
                }

                const result = await importarContatosLoteCSV(parsedData);
                if (result.success && orphanosCount > 0) {
                    result.orphanosCount = orphanosCount;
                }
                resolve(result);
            };

            reader.onerror = () => {
                toast.error('Falha ao ler o arquivo CSV de Contatos.');
                resolve({ success: false });
            };
            reader.readAsText(fileContatos, 'utf-8');
        });
    };

    const handleExecutarImportacaoGeral = async () => {
        if (!filePacientes && !fileExames && !fileConsultas && !fileDesfechos && !fileContatos) {
            toast.warn('Selecione ao menos um arquivo CSV para a importação.');
            return;
        }

        setIsMigrating(true);
        let mudouAlgo = false;

        // Tries Pacientes
        const resPacientes = await handleMigracaoPacientes();
        if (resPacientes && resPacientes.success) {
            toast.success(`${resPacientes.count} pacientes importados com sucesso.`);
            setFilePacientes(null);
            mudouAlgo = true;
        } else if (resPacientes && resPacientes.error) {
            toast.error(`Falha Pacientes: ${resPacientes.error}`);
        }

        // Tries Exames
        const resExames = await handleMigracaoExames();
        if (resExames && resExames.success) {
            toast.success(`${resExames.count} exames importados e vinculados aos pacientes com sucesso!`);
            if (resExames.orphanosCount > 0) {
                toast.warning(`${resExames.orphanosCount} exames ignorados pois não possuíam paciente vinculado.`);
            }
            setFileExames(null);
            mudouAlgo = true;
        } else if (resExames && resExames.error) {
            toast.error(`Falha Exames: ${resExames.error}`);
        }

        // Tries Consultas
        const resConsultas = await handleMigracaoConsultas();
        if (resConsultas && resConsultas.success) {
            toast.success(`${resConsultas.count} consultas importadas e vinculadas aos pacientes com sucesso!`);
            if (resConsultas.orphanosCount > 0) {
                toast.warning(`${resConsultas.orphanosCount} consultas ignoradas pois não possuíam paciente vinculado.`);
            }
            setFileConsultas(null);
            mudouAlgo = true;
        } else if (resConsultas && resConsultas.error) {
            toast.error(`Falha Consultas: ${resConsultas.error}`);
        }

        // Tries Desfechos
        const resDesfechos = await handleMigracaoDesfechos();
        if (resDesfechos && resDesfechos.success) {
            toast.success(`${resDesfechos.count} desfechos importados e vinculados aos pacientes com sucesso!`);
            if (resDesfechos.orphanosCount > 0) {
                toast.warning(`${resDesfechos.orphanosCount} desfechos ignorados pois não possuíam paciente vinculado.`);
            }
            setFileDesfechos(null);
            mudouAlgo = true;
        } else if (resDesfechos && resDesfechos.error) {
            toast.error(`Falha Desfechos: ${resDesfechos.error}`);
        }

        // Tries Contatos
        const resContatos = await handleMigracaoContatos();
        if (resContatos && resContatos.success) {
            toast.success(`${resContatos.count} contatos registrados e vinculados com sucesso!`);
            if (resContatos.orphanosCount > 0) {
                toast.warning(`${resContatos.orphanosCount} contatos ignorados pois não possuíam paciente vinculado.`);
            }
            setFileContatos(null);
            mudouAlgo = true;
        } else if (resContatos && resContatos.error) {
            toast.error(`Falha Contatos: ${resContatos.error}`);
        }

        if (mudouAlgo) {
            setShowModalMigracao(false);
            fetchConfigs();
        }

        setIsMigrating(false);
    };

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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Parametrização Clínica</h2>
                    <p className="text-sm text-slate-500 mt-1 font-light">Gerencie os dicionários de dados dinâmicos utilizados no módulo de Telemonitoramento.</p>
                </div>
                <button
                    onClick={() => setShowModalMigracao(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importar Dados em Lote (Migração CSV)
                </button>
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

            {showModalMigracao && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full p-6 bg-white rounded-2xl shadow-2xl">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Migração de Dados Legados (Lote)</h3>
                            <p className="text-sm text-slate-500 mt-1">Atenção: Esta ação importa arquivos CSV para o banco de dados. Certifique-se de que os dados estão no formato correto.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">Base de Pacientes</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    disabled={isMigrating}
                                    onChange={(e) => setFilePacientes(e.target.files[0])}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 focus:outline-none"
                                />
                            </div>

                            {/* EXAMES ATIVO */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">Histórico de Exames</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    disabled={isMigrating}
                                    onChange={(e) => setFileExames(e.target.files[0])}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 focus:outline-none"
                                />
                            </div>

                            {/* CONSULTAS ATIVO */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">Consultas Ambulatoriais</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    disabled={isMigrating}
                                    onChange={(e) => setFileConsultas(e.target.files[0])}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 focus:outline-none"
                                />
                            </div>

                            {/* DESFECHOS ATIVO */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">Desfechos</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    disabled={isMigrating}
                                    onChange={(e) => setFileDesfechos(e.target.files[0])}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 focus:outline-none"
                                />
                            </div>

                            {/* CONTATOS ATIVO */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">Contatos Realizados</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    disabled={isMigrating}
                                    onChange={(e) => setFileContatos(e.target.files[0])}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 focus:outline-none"
                                />
                            </div>

                            {[
                                "Logs do Sistema Antigo"
                            ].map((label, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 opacity-50 cursor-not-allowed">
                                    <label className="text-sm font-semibold text-slate-700">{label}</label>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        disabled={true}
                                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed bg-slate-100 focus:outline-none"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => {
                                    setFilePacientes(null);
                                    setFileExames(null);
                                    setFileConsultas(null);
                                    setFileDesfechos(null);
                                    setFileContatos(null);
                                    setShowModalMigracao(false);
                                }}
                                disabled={isMigrating}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExecutarImportacaoGeral}
                                disabled={isMigrating}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:bg-emerald-300 disabled:cursor-wait"
                            >
                                {isMigrating ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Carregando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Executar Importação
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
