// Lista de setores globais utilizadas no HMSJ
// Letras maiusculas e ordem alfabética garantida para padronizar inputs no banco do Firebase.

const rawSetores = [
    "CEDUG",
    "AVC Agudo",
    "AIT Minor",
    "Sala Laranja",
    "Decisão Clínica",
    "Decisão Cirúrgica",
    "JS Ortopedia 1",
    "JS Ortopedia 2",
    "UTI 1",
    "UTI 2",
    "UTI 3",
    "UTI 4",
    "Unidade Cirúrgica (UCX)",
    "Unidade de Clínica Médica (UCM)",
    "Unidade de Internação Geral (UIG)",
    "Unidade de Oncologia",
    "CC - Sala de Recuperação",
    "AVC Integral",
    "Unidade de Transplantes (UTX)"
];

export const setoresHmsj = rawSetores
    .map(setor => setor.toUpperCase())
    .sort((a, b) => a.localeCompare(b));
