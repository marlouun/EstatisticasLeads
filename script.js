// URL da sua planilha publicada (CSV)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8_SOwxi2ang2xisCsvzKoCcM7isb47BDCo-SUNvMa2ljobp1FvkjRr0AUi9RCEpl9qhnDV2g9lWFd/pub?output=csv';

// Variáveis globais para os gráficos
let chartSituacaoInstance = null;
let chartTrafegoInstance = null;

// Função principal
function carregarDados() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';

    Papa.parse(SHEET_URL, {
        download: true,
        header: false, // Não usar header automático pois a planilha tem linhas extras
        complete: function(results) {
            try {
                processarDados(results.data);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';

                const agora = new Date();
                document.getElementById('lastUpdate').innerText = agora.toLocaleString('pt-BR');
            } catch (e) {
                mostrarErro("Erro ao processar dados: " + e.message);
            }
        },
        error: function(err) {
            mostrarErro("Erro ao baixar a planilha. Verifique se o link está correto e público.");
        }
    });
}

function processarDados(rows) {
    // Índices baseados na estrutura da planilha:
    // 0: DIA, 3: TRÁFEGO, 4: SITUAÇÃO, 5: VALOR PEDIDO

    let totalVendas = 0;
    let countFechados = 0;
    let totalLeads = 0;

    let statsSituacao = {};
    let statsTrafego = {};

    // Regex para validar data (dd/mm/yyyy) e ignorar cabeçalhos como "MAIO"
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    rows.forEach((row, index) => {
        // Pega a coluna DIA (índice 0)
        const dia = row[0] ? row[0].trim() : '';

        // Se a linha começa com uma data válida, é um dado real
        if (dateRegex.test(dia)) {
            totalLeads++;

            // Processar Situação
            const situacao = row[4] ? row[4].trim().toUpperCase() : 'NÃO INFORMADO';
            statsSituacao[situacao] = (statsSituacao[situacao] || 0) + 1;

            // Processar Tráfego
            const trafego = row[3] ? row[3].trim().toUpperCase() : 'NÃO INFORMADO';
            statsTrafego[trafego] = (statsTrafego[trafego] || 0) + 1;

            // Processar Valores (Se fechado)
            // Verifica se a situação indica venda fechada
            if (situacao.includes('FECHADO') || situacao.includes('PAGO') || situacao === 'OK') {
                countFechados++;

                let valorStr = row[5]; // Coluna VALOR PEDIDO
                if (valorStr) {
                    // Limpa string: "R$ 1.367,63" -> 1367.63
                    // Remove R$, espaços, pontos de milhar, e troca vírgula decimal por ponto
                    let valorLimpo = valorStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                    let valor = parseFloat(valorLimpo);
                    if (!isNaN(valor)) {
                        totalVendas += valor;
                    }
                }
            }
        }
    });

    // Atualiza UI dos Cards
    document.getElementById('totalVendas').innerText = totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('totalFechados').innerText = countFechados;
    document.getElementById('totalLeads').innerText = totalLeads;

    let taxa = totalLeads > 0 ? (countFechados / totalLeads) * 100 : 0;
    document.getElementById('taxaConversao').innerText = taxa.toFixed(1) + '%';

    // Atualiza Gráficos
    atualizarGrafico('chartSituacao', 'Situação dos Leads', statsSituacao, chartSituacaoInstance, 'bar');
    atualizarGrafico('chartTrafego', 'Origem do Tráfego', statsTrafego, chartTrafegoInstance, 'pie');
}

function atualizarGrafico(canvasId, label, dadosObj, chartInstance, tipo) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const labels = Object.keys(dadosObj);
    const data = Object.values(dadosObj);

    // Destroi gráfico anterior se existir para evitar sobreposição
    const chartStatus = Chart.getChart(canvasId);
    if (chartStatus) {
        chartStatus.destroy();
    }

    // Cores dinâmicas
    const cores = [
        '#0d6efd', '#198754', '#ffc107', '#0dcaf0', '#dc3545', '#6610f2', '#fd7e14', '#20c997'
    ];

    new Chart(ctx, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade',
                data: data,
                backgroundColor: cores.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: tipo === 'pie' ? 'right' : 'top',
                }
            }
        }
    });
}

function mostrarErro(msg) {
    const el = document.getElementById('error-msg');
    el.innerText = msg;
    el.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
}

// Carregar ao abrir a página
window.onload = carregarDados;
