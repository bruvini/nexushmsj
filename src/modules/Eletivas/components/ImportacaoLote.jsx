import React from 'react';
import { lerArquivoExcel } from '../../../utils/excelUtils';
import { toast } from 'react-toastify';

export default function ImportacaoLote({ onImport }) {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Recebe o objeto com totais e o array de dados
      const resultado = await lerArquivoExcel(file);
      onImport(resultado);
      
      // Limpa o input
      e.target.value = null;
    } catch (error) {
      console.error("Erro ao ler o arquivo Excel:", error);
      toast.error("Erro ao ler o arquivo. Verifique se é um formato válido.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-medium text-slate-700 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Importar Pacientes em Lote (Excel)
      </h2>
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-500 
          file:mr-4 file:py-2.5 file:px-4 
          file:rounded-xl file:border-0 
          file:text-sm file:font-semibold 
          file:bg-emerald-50 file:text-emerald-700 
          hover:file:bg-emerald-100 cursor-pointer transition-colors"
      />
    </div>
  );
}