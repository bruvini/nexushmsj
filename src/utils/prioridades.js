/**
 * Função pura para cálculo reativo de prioridade baseada no SIGTAP.
 * Higieniza o estado anterior legado e blinda contra sobrescritas indevidas.
 *
 * Regra: SIGTAPs iniciados em 0416 ou 416 resultam em ONCOLOGIA,
 * desde que não haja prioridade legal superior (JUDICIAL/CARTA DE PRIORIDADE).
 */
export function calcularPrioridadeSigtap(codigoSigtap, prioridadeAtual) {
    let prioHigienizada = 'NENHUMA';

    if (prioridadeAtual) {
        const p = prioridadeAtual.toString().toUpperCase().trim();
        if (p === 'ONCOLOGIA') prioHigienizada = 'ONCOLOGIA';
        else if (p === 'CARTA DE PRIORIDADE') prioHigienizada = 'CARTA DE PRIORIDADE';
        else if (p === 'JUDICIAL') prioHigienizada = 'JUDICIAL';
    }

    // Preserva soberania de prioridades legais
    if (prioHigienizada === 'CARTA DE PRIORIDADE' || prioHigienizada === 'JUDICIAL') {
        return prioHigienizada;
    }

    // Automatismo Oncológico
    if (codigoSigtap) {
        // Extrai apenas números para prevenir formatações como 04.16...
        const codNum = codigoSigtap.toString().replace(/\D/g, '');
        if (codNum.startsWith('416') || codNum.startsWith('0416')) {
            return 'ONCOLOGIA';
        }
    }

    return prioHigienizada;
}
