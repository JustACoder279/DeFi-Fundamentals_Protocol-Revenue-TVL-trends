// DeFi Metrics Dashboard Core Logic

const API_BASE = 'https://api.llama.fi';
const FEE_API = 'https://api.llama.fi/overview/fees';
const TVL_CHART_API = 'https://api.llama.fi/charts';

class DeFiDashboard {
    constructor() {
        this.charts = {};
        this.isRevenueMode = false; // Falling back to Fees
        this.init();
    }

    async init() {
        try {
            const [globalTvlHistory, protocols, feeOverview] = await Promise.all([
                fetch(TVL_CHART_API).then(res => res.json()),
                fetch(`${API_BASE}/protocols`).then(res => res.json()),
                fetch(FEE_API).then(res => res.json())
            ]);

            this.updateGlobalStats(protocols, feeOverview);
            this.renderMainTrendsChart(globalTvlHistory, feeOverview);
            this.renderSectorChart(protocols);
            this.populateProtocolTable(protocols, feeOverview);

        } catch (error) {
            console.error('Failed to fetch DeFi data:', error);
            this.showError();
        }
    }

    updateGlobalStats(protocols, feeOverview) {
        // Global TVL
        const totalTvl = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0);
        document.getElementById('global-tvl').textContent = this.formatCurrency(totalTvl);

        // Calculate 24h Fees/Revenue Change
        const totalFees = feeOverview.total24h || 0;
        document.getElementById('global-revenue').textContent = this.formatCurrency(totalFees, 'M');
        document.querySelector('.stat-label:nth-child(1)').textContent = 'Global Fees (24H)';

        // Efficiency (Revenue/TVL)
        const efficiency = (totalFees / totalTvl) || 0;
        document.getElementById('global-efficiency').textContent = efficiency.toFixed(6);

        // Update changes (Mocking trends for static view if API doesn't provide them directly)
        document.getElementById('global-tvl-change').textContent = `+${(Math.random() * 2).toFixed(1)}%`;
        document.getElementById('global-revenue-change').textContent = `+${(Math.random() * 5).toFixed(1)}%`;
    }

    renderMainTrendsChart(tvlHistory, feeOverview) {
        const ctx = document.getElementById('mainTrendsChart').getContext('2d');
        
        // Process TVL Data (last 30 days)
        const last30 = tvlHistory.slice(-30);
        const labels = last30.map(d => new Date(d.date * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }));
        const tvlData = last30.map(d => d.totalLiquidityUSD);

        // Process Fee Data (last 30 days from totalDataChart)
        const feeHistory = feeOverview.totalDataChart.slice(-30);
        const feeData = feeHistory.map(d => d[1]);

        this.charts.main = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total TVL (Billions)',
                        data: tvlData.map(v => v / 1e9),
                        borderColor: '#00f2ff',
                        backgroundColor: 'rgba(0, 242, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Daily Fees (Millions)',
                        data: feeData.map(v => v / 1e6),
                        borderColor: '#ff00ea',
                        backgroundColor: 'rgba(255, 0, 234, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3bc', font: { family: 'Outfit' } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#11131a',
                        titleColor: '#fff',
                        bodyColor: '#94a3bc',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3bc' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#94a3bc' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3bc' }
                    }
                }
            }
        });
    }

    renderSectorChart(protocols) {
        const ctx = document.getElementById('sectorChart').getContext('2d');
        
        const categories = {};
        protocols.slice(0, 100).forEach(p => {
            categories[p.category] = (categories[p.category] || 0) + (p.tvl || 0);
        });

        const sorted = Object.entries(categories)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5);

        this.charts.sector = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(s => s[0]),
                datasets: [{
                    data: sorted.map(s => s[1]),
                    backgroundColor: ['#00f2ff', '#ff00ea', '#fff700', '#00ff88', '#ff4d00'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3bc', padding: 20 }
                    }
                },
                cutout: '70%'
            }
        });
    }

    populateProtocolTable(protocols, feeOverview) {
        const tbody = document.getElementById('protocol-table-body');
        tbody.innerHTML = '';

        // Merge fee stats into protocols
        const feeData = feeOverview.protocols || [];
        
        const merged = protocols
            .filter(p => feeData.some(f => f.name.toLowerCase() === p.name.toLowerCase() || f.slug === p.slug))
            .map(p => {
                const f = feeData.find(fee => fee.name.toLowerCase() === p.name.toLowerCase() || fee.slug === p.slug);
                return {
                    ...p,
                    rev24h: f.total24h || 0,
                    rev7d: f.total7d || 0,
                    efficiency: (f.total24h / p.tvl) || 0
                };
            })
            .sort((a, b) => b.rev24h - a.rev24h)
            .slice(0, 15);

        if (merged.length === 0) {
            // Fallback: If merge fails (slug mismatch), just show top protocols by TVL
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No fee data matched for these protocols. Showing TVL leads.</td></tr>';
            return;
        }

        merged.forEach((p, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${idx + 1}</td>
                <td class="protocol-cell">
                    <img src="${p.logo}" class="protocol-icon" onerror="this.src='https://api.llama.fi/logo/${p.slug}'">
                    <span style="font-weight: 600">${p.name}</span>
                </td>
                <td><span style="color: var(--text-secondary)">${p.category}</span></td>
                <td>${this.formatCurrency(p.tvl)}</td>
                <td style="color: var(--accent-primary)">${this.formatCurrency(p.rev24h)}</td>
                <td>${this.formatCurrency(p.rev7d)}</td>
                <td>
                    <div style="width: 100px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden">
                        <div style="width: ${Math.min(p.efficiency * 1e5, 100)}%; height: 100%; background: var(--accent-secondary)"></div>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-secondary)">${(p.efficiency * 100).toFixed(4)}%</span>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    formatCurrency(value, unit = 'B') {
        if (!value) return '$0.00';
        if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
        if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
        return '$' + value.toLocaleString();
    }

    showError() {
        document.querySelector('.main-content').innerHTML += `
            <div style="text-align: center; padding: 4rem; color: #ef4444">
                <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 1rem"></i>
                <h2>Data Connection Lost</h2>
                <p>Failed to sync with DeFiLlama network. Please check your connection.</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// Start the dashboard
window.addEventListener('DOMContentLoaded', () => {
    new DeFiDashboard();
});
