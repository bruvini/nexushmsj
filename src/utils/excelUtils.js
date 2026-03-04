import * as XLSX from 'xlsx';

export const lerArquivoExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // CORREÇÃO DA DATA AQUI: { raw: false }
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        // Filtra pelo tipo especificado
        const ambulatoriais = jsonData.filter(row => row.tipo_atendimento === 'Ambulatorial');
        
        // Retornamos um objeto com os totais para usar no relatório de conclusão
        resolve({
          totalLinhas: jsonData.length,
          totalAmbulatorial: ambulatoriais.length,
          dados: ambulatoriais
        });
        
      } catch (error) { reject(error); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};