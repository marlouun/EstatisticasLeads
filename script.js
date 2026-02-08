// URL da sua planilha publicada (CSV)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8_SOwxi2ang2xisCsvzKoCcM7isb47BDCo-SUNvMa2ljobp1FvkjRr0AUi9RCEpl9qhnDV2g9lWFd/pub?output=csv';

// Variável global para armazenar todos os dados e evitar downloads repetidos
let allData = [];
const DIA_COL = 0, TRAFEGO_COL = 3, SITUACAO_COL = 4, VALOR_COL = 5;

// 1. Função principal: Carrega os dados da planilha na inicialização
function carregarDados() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';

    Papa.parse(SHEET_URL, {
        download: true,
        header: false,
        complete: function(results) {
            try {
                allData = results.data; // Armazena todos os dados globalmente
                popularFiltroMes(allData); // Popula o seletor de mês
                filtrarDadosPorMes(); // Exibe os dados (inicialmente "Geral")
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
            } catch (e) {
                mostrarErro("Erro ao processar dados: " + e.message);
            }
        },
        error: function() {
            mostrarErro("Não foi possível carregar os dados. Verifique o link da planilha.");
        }
    });
}

// 2. Popula o seletor de mês com base nos dados disponíveis
function popularFiltroMes(data) {
    const monthFilter = document.getElementById('monthFilter');
    monthFilter.innerHTML = '<option value="geral">Geral</option>'; // Limpa e adiciona a opção "Geral"
    
    const months = new Set();
    const dateRegex = /^\d{2}\/(\d{2}\/\d{4})$/;

    data.forEach(row => {
        const dia = row[DIA_COL] ? row[DIA_COL].trim() : '';
        const match = dia.match(dateRegex);
        if (match) {
            months.add(match[1]); // Adiciona "MM/YYYY" ao Set
        }
    });

    // Ordena os meses (opcional, mas melhora a UX)
    const sortedMonths = Array.from(months).sort((a, b) => {
        const [m1, y1] = a.split('/');
        const [m2, y2] = b.split('/');
        return new Date(y2, m2 - 1) - new Date(y1, m1 - 1);
    });

    sortedMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        monthFilter.appendChild(option);
    });
}

// 3. Filtra os dados com base no mês selecionado e atualiza o dashboard
function filtrarDadosPorMes() {
    const selectedMonth = document.getElementById('monthFilter').value;
    
    if (selectedMonth === 'geral') {
        processarEAtualizarDashboard(allData); // Usa todos os dados
    } else {
        const filteredData = allData.filter(row => {
            const dia = row[DIA_COL] || '';
            return dia.includes(selectedMonth);
        });
        processarEAtualizarDashboard(filteredData); // Usa apenas os dados do mês
    }
    document.getElementById('lastUpdate').innerText = new Date().toLocaleString('pt-BR');
}

// 4. Processa os dados (filtrados ou não) e atualiza os cards e gráficos
function processarEAtualizarDashboard(data) {
    let totalVendas = 0, countFechados = 0, totalLeads = 0;
    let statsSituacao = {}, statsTrafego = {}, vendasPorDia = {};
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    data.forEach(row => {
        if (row && dateRegex.test(row[DIA_COL])) {
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
                    vendasPorDia[row[DIA_COL].trim()] = (vendasPorDia[row[DIA_COL].trim()] || 0) + valor;
                }
            }
        }
    });

    const sortedVendas = Object.entries(vendasPorDia).sort((a, b) => new Date(a[0].split('/').reverse().join('-')) - new Date(b[0].split('/').reverse().join('-')));
    const taxaConversao = totalLeads > 0 ? (countFechados / totalLeads) * 100 : 0;
    const ticketMedio = countFechados > 0 ? totalVendas / countFechados : 0;

    document.getElementById('totalVendas').innerText = totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('totalFechados').innerText = countFechados;
    document.getElementById('totalLeads').innerText = totalLeads;
    document.getElementById('taxaConversao').innerText = taxaConversao.toFixed(1) + '%';
    document.getElementById('ticketMedio').innerText = ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    atualizarGrafico('chartSituacao', 'bar', statsSituacao, 'Status dos Leads');
    atualizarGrafico('chartTrafego', 'pie', statsTrafego, 'Origem do Tráfego');
    atualizarGrafico('chartVendasDia', 'line', { labels: sortedVendas.map(item => item[0]), data: sortedVendas.map(item => item[1]) }, 'Vendas por Dia');
}

// 5. Função de gráficos com a paleta de cores refinada
function atualizarGrafico(canvasId, tipo, dados, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (Chart.getChart(canvasId)) Chart.getChart(canvasId).destroy();

    const isLineChart = tipo === 'line';
    const labels = isLineChart ? dados.labels : Object.keys(dados);
    const data = isLineChart ? dados.data : Object.values(dados);

    // Paleta de cores elegante e com bom contraste
    const elegantPalette = ['#6997e6', '#b31763', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444'];
    
    const lineGradient = ctx.createLinearGradient(0, 0, 0, 300); // Altura ajustada
    lineGradient.addColorStop(0, 'rgba(44, 44, 44, 0.4)'); // Gradiente cinza sutil
    lineGradient.addColorStop(1, 'rgba(44, 44, 44, 0)');

    const chartData = {
        labels: labels,
        datasets: [{
            label: label,
            data: data,
            backgroundColor: isLineChart ? lineGradient : elegantPalette,
            borderColor: '#FFFFFF', // Linha branca para o gráfico de linha
            fill: isLineChart,
            tension: 0.4,
            borderWidth: isLineChart ? 2 : 0, // Remove contorno dos gráficos de pizza/barra
            pointBackgroundColor: '#FFFFFF',
            pointRadius: isLineChart ? 4 : 0,
            pointHoverRadius: isLineChart ? 6 : 0,
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: tipo === 'pie', position: 'right', labels: { color: '#9E9E9E' } },
            tooltip: { backgroundColor: '#121212', titleColor: '#FFFFFF', bodyColor: '#E0E0E0', borderColor: '#2C2C2C', borderWidth: 1 }
        },
        scales: {
            y: { beginAtZero: true, display: tipo !== 'pie', grid: { color: '#2C2C2C' }, ticks: { color: '#9E9E9E' } },
            x: { display: tipo !== 'pie', grid: { display: false }, ticks: { color: '#9E9E9E' } }
        }
    };

    new Chart(ctx, { type: tipo, data: chartData, options: options });
}

function mostrarErro(msg) {
    const el = document.getElementById('error-msg');
    el.innerText = msg;
    el.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
}

// Inicia o carregamento dos dados quando a página é aberta
window.onload = carregarDados;
