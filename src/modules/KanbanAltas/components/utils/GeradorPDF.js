// src/modules/KanbanAltas/components/utils/GeradorPDF.js

const SETORES_URGENCIA = [
    "PS DECISÃO CIRURGICA", 
    "PS DECISÃO CLINICA", 
    "SALA DE EMERGENCIA", 
    "SALA LARANJA"
  ];
  
  const parseDate = (str) => {
    if (!str) return new Date();
    if (str instanceof Date) return str;
    const stringData = String(str).split(' ')[0];
    if (stringData.includes('/')) {
      const partes = stringData.split('/');
      return new Date(partes[2], partes[1] - 1, partes[0]);
    }
    const d = new Date(stringData);
    return isNaN(d.getTime()) ? new Date() : d;
  };
  
  export const gerarRelatorioRondas = (pacientes) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
  
    // 1. Filtra apenas pacientes de Urgência que estejam Ativos/Sinalizados
    const pacientesUrgencia = pacientes.filter(p => {
      const status = String(p.status || '').trim().toUpperCase();
      const setor = String(p.setor || '').trim().toUpperCase();
      return (status === "ATIVO" || status === "SINALIZADA") && SETORES_URGENCIA.includes(setor);
    });
  
    // 2. Agrupa por Setor e Ordena por Leito
    const agrupados = {};
    pacientesUrgencia.sort((a, b) => String(a.leito).localeCompare(String(b.leito), undefined, { numeric: true, sensitivity: 'base' }));
    
    pacientesUrgencia.forEach(p => {
      const setor = String(p.setor).toUpperCase();
      if (!agrupados[setor]) agrupados[setor] = [];
      agrupados[setor].push(p);
    });
  
    const setoresOrdenados = Object.keys(agrupados).sort();
    const dataAtual = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  
    // 3. Constrói o HTML com CSS focado em impressão (Print Media Queries)
    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Rondas - Urgência</title>
        <style>
          @page { size: A4 portrait; margin: 1.5cm; }
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            font-size: 11px; 
            color: #000; 
            margin: 0; 
            padding: 0;
            background: #fff;
          }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 18px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
          .header p { margin: 0; font-size: 10px; color: #555; }
          .instructions { 
            border: 1px solid #000; 
            padding: 8px 10px; 
            margin-bottom: 15px; 
            font-size: 10px; 
            line-height: 1.4; 
            background-color: #f8fafc; 
            border-radius: 4px;
          }
          .setor-title { 
            font-size: 14px; 
            margin: 20px 0 5px 0; 
            background-color: #e2e8f0; 
            padding: 6px 10px; 
            border: 1px solid #000; 
            border-bottom: none; 
            page-break-after: avoid; 
            text-transform: uppercase;
            font-weight: bold;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px; 
            border: 1px solid #000; 
          }
          th, td { 
            border: 1px solid #000; 
            padding: 6px; 
            vertical-align: top; 
          }
          th { 
            background-color: #f1f5f9; 
            font-weight: bold; 
            text-transform: uppercase; 
            font-size: 9px; 
            text-align: left;
          }
          td { font-size: 10px; line-height: 1.3; }
          tr { page-break-inside: avoid; }
          tr:nth-child(even) { background-color: #fafafa; }
          
          .col-leito { width: 12%; font-weight: bold; font-size: 11px; text-align: center; }
          .col-nome { width: 33%; font-weight: bold; text-transform: uppercase; }
          .col-sexo { width: 5%; text-align: center; }
          .col-dias { width: 10%; text-align: center; font-weight: bold; }
          .col-obs { width: 40%; min-height: 45px; } /* Min-height garante espaço para escrever a caneta */
          
          .meta-info { font-size: 9px; font-weight: normal; color: #555; display: block; margin-top: 2px; }
          .sisreg-badge { 
            display: inline-block;
            font-weight: bold; 
            padding-bottom: 2px; 
            border-bottom: 1px dashed #000; 
            margin-bottom: 4px; 
          }
          .nota-hist { font-size: 9px; color: #333; margin-top: 4px; font-style: italic; }
          .empty-state { text-align: center; margin-top: 40px; font-style: italic; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Rondas - Urgência</h1>
          <p>Gerado pelo Ecossistema Nexus em: ${dataAtual}</p>
        </div>
        
        <div class="instructions">
          <strong>INSTRUÇÃO OPERACIONAL:</strong> Utilize este formulário impresso durante as rondas diárias. A coluna "OBSERVAÇÕES" contém espaço livre para anotações a caneta (evoluções, pendências para alta ou solicitações SISREG). <strong>ATENÇÃO:</strong> Logo após a ronda, transcreva as anotações físicas imediatamente para o Sistema Nexus para atualizar o Kanban.
        </div>
    `;
  
    if (setoresOrdenados.length === 0) {
      html += `<div class="empty-state">Nenhum paciente ativo localizado nos setores de Urgência no momento.</div>`;
    } else {
      for (const setor of setoresOrdenados) {
        html += `<div class="setor-title">📍 ${setor} (Total: ${agrupados[setor].length})</div>`;
        html += `
          <table>
            <thead>
              <tr>
                <th class="col-leito">LEITO</th>
                <th class="col-nome">NOME DO PACIENTE</th>
                <th class="col-sexo">SEXO</th>
                <th class="col-dias">DIAS INT.</th>
                <th class="col-obs">OBSERVAÇÕES (Preenchimento / Histórico)</th>
              </tr>
            </thead>
            <tbody>
        `;
  
        agrupados[setor].forEach(p => {
          // Cálculo de Dias
          const dInt = parseDate(p.dataInternacao);
          dInt.setHours(0, 0, 0, 0);
          const dias = Math.floor((hoje - dInt) / (1000 * 60 * 60 * 24));
  
          // Construção da Observação Dinâmica
          let obsHTML = '';
          
          // Tem Sisreg?
          const numSisreg = String(p.numeroSisreg || "").trim();
          if (numSisreg) {
            obsHTML += `<div class="sisreg-badge">SISREG: ${numSisreg}</div><br>`;
          }
  
          // Tem Notas?
          try {
            const notas = JSON.parse(p.historicoJson || "[]");
            if (notas.length > 0) {
              const ultima = notas[0];
              let txt = ultima.texto;
              if (txt.length > 120) txt = txt.substring(0, 120) + '...';
              const dataNota = String(ultima.data).split(' ')[0];
              obsHTML += `<div class="nota-hist"><b>Últ. Nota (${dataNota}):</b> ${txt}</div>`;
            }
          } catch (e) { }
  
          html += `
            <tr>
              <td class="col-leito">${p.leito || '-'}</td>
              <td class="col-nome">
                ${p.nome || '-'}
                ${p.nascimento ? `<span class="meta-info">Nasc: ${p.nascimento}</span>` : ''}
              </td>
              <td class="col-sexo">${p.sexo || '-'}</td>
              <td class="col-dias">${dias}</td>
              <td class="col-obs">${obsHTML}</td>
            </tr>
          `;
        });
  
        html += `</tbody></table>`;
      }
    }
  
    html += `
      </body>
      </html>
    `;
  
    // 4. Abre uma nova janela, injeta o HTML e chama a impressão
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      toast.error("O navegador bloqueou o pop-up de impressão. Permita os pop-ups para este site.");
      return;
    }
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Aguarda o navegador renderizar os elementos antes de imprimir
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Opcional: printWindow.close() após imprimir, mas deixar aberto permite que o usuário salve em PDF ou tente novamente.
    }, 250);
  };