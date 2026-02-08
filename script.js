// URL da sua planilha publicada (CSV)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8_SOwxi2ang2xisCsvzKoCcM7isb47BDCo-SUNvMa2ljobp1FvkjRr0AUi9RCEpl9qhnDV2g9lWFd/pub?output=csv';

// Função principal que é chamada ao carregar a página e ao clicar no botão de atualizar
function carregarDados() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';

    Papa.parse(SHEET_URL, {
        download: true,
        header: false,
        complete: function(results) {
            try {
                processarDados(results.data);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
                document.getElementById('lastUpdate').innerText = new Date().toLocaleString('pt-BR');
            } catch (e) {
                mostrarErro("Erro ao processar dados: " + e.message);
            }
        },
        error: function() {
            mostrarErro("Não foi possível carregar os dados da planilha. Verifique se o link está correto e se a planilha está publicada para a web.");
        }
    });
}

// Função para processar os dados brutos da planilha
function processarDados(rows) {
    // Índices das colunas
    const DIA_COL = 0, TRAFEGO_COL = 3, SITUACAO_COL = 4, VALOR_COL = 5;

    let totalVendas = 0, countFechados = 0, totalLeads = 0;
    let statsSituacao = {}, statsTrafego = {}, vendasPorDia = {};

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    rows.forEach(row => {
        const dia = row[DIA_COL] ? row[DIA_COL].trim() : '';
        if (dateRegex.test(dia)) {
            totalLeads++;

            const situacao = (row[SITUACAO_COL] || 'N/A').trim().toUpperCase();
            const trafego = (row[TRAFEGO_COL] || 'N/A').trim().toUpperCase();

            statsSituacao[situacao] = (statsSituacao[situacao] || 0) + 1;
            statsTrafego[trafego] = (statsTrafego[trafego] || 0) + 1;

            if (situacao.includes('FECHADO') || situacao.includes('PAGO') || situacao === 'OK') {
                countFechados++;
                let valorStr = row[VALOR_COL] || '0';
                let valorLimpo = valorStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                let valor = parseFloat(valorLimpo);

                if (!isNaN(valor)) {
                    totalVendas += valor;
                    vendasPorDia[dia] = (vendasPorDia[dia] || 0) + valor;
                }
            }
        }
    });

    // Ordenar vendas por dia
    const sortedVendas = Object.entries(vendasPorDia).sort((a, b) => new Date(a[0].split('/').reverse().join('-')) - new Date(b[0].split('/').reverse().join('-')));
    const labelsVendasDia = sortedVendas.map(item => item[0]);
    const dataVendasDia = sortedVendas.map(item => item[1]);

    // Calcular métricas
    const taxaConversao = totalLeads > 0 ? (countFechados / totalLeads) * 100 : 0;
    const ticketMedio = countFechados > 0 ? totalVendas / countFechados : 0;

    // Atualizar cards
    document.getElementById('totalVendas').innerText = totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('totalFechados').innerText = countFechados;
    document.getElementById('totalLeads').innerText = totalLeads;
    document.getElementById('taxaConversao').innerText = taxaConversao.toFixed(1) + '%';
    document.getElementById('ticketMedio').innerText = ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Atualizar gráficos
    atualizarGrafico('chartSituacao', 'bar', statsSituacao, 'Status dos Leads');
    atualizarGrafico('chartTrafego', 'pie', statsTrafego, 'Origem do Tráfego');
    atualizarGrafico('chartVendasDia', 'line', { labels: labelsVendasDia, data: dataVendasDia }, 'Vendas por Dia');
}

// Função genérica para criar ou atualizar um gráfico com o tema de cinza
function atualizarGrafico(canvasId, tipo, dados, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (Chart.getChart(canvasId)) {
        Chart.getChart(canvasId).destroy();
    }

    const isLineChart = tipo === 'line';
    const labels = isLineChart ? dados.labels : Object.keys(dados);
    const data = isLineChart ? dados.data : Object.values(dados);

    // Paleta de cores em tons de cinza
    const grayScalePalette = ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#616161', '#424242'];
    
    const lineGradient = ctx.createLinearGradient(0, 0, 0, 400);
    lineGradient.addColorStop(0, 'rgba(224, 224, 224, 0.2)');
    lineGradient.addColorStop(1, 'rgba(224, 224, 224, 0)');

    const chartData = {
        labels: labels,
        datasets: [{
            label: label,
            data: data,
            backgroundColor: isLineChart ? lineGradient : grayScalePalette,
            borderColor: '#FFFFFF',
            fill: isLineChart,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#FFFFFF',
            pointRadius: 4,
            pointHoverRadius: 6,
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: tipo === 'pie',
                position: 'right',
                labels: {
                    color: '#9E9E9E' // Cor do texto da legenda
                }
            },
            tooltip: {
                backgroundColor: '#121212',
                titleColor: '#FFFFFF',
                bodyColor: '#E0E0E0',
                borderColor: '#2C2C2C',
                borderWidth: 1
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                display: tipo !== 'pie',
                grid: {
                    color: '#2C2C2C' // Cor das linhas da grade Y
                },
                ticks: {
                    color: '#9E9E9E' // Cor dos rótulos do eixo Y
                }
            },
            x: {
                display: tipo !== 'pie',
                grid: {
                    display: false
                },
                ticks: {
                    color: '#9E9E9E' // Cor dos rótulos do eixo X
                }
            }
        }
    };

    new Chart(ctx, { type: tipo, data: chartData, options: options });
}

// Função para exibir mensagens de erro
function mostrarErro(msg) {
    const el = document.getElementById('error-msg');
    el.innerText = msg;
    el.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
}

// Carregar os dados assim que a página for aberta
window.onload = carregarDados;
