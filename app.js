/**
 * Smart Factory Monitoring Dashboard
 * Persian Language Industrial PWA
 * Author: Assistant
 */

// Global variables
let csvData = [];
let charts = {};
let currentSection = 'dashboard';

// Application initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        // Show loading screen
        showLoadingScreen();
        
        // Initialize navigation
        initializeNavigation();
        
        // Load and parse CSV data
        await loadCSVData();
        
        // Initialize all sections
        initializeDashboard();
        initializeEnvironment();
        initializeMachinery();
        initializeSecurity();
        
        // Hide loading screen
        hideLoadingScreen();
        
        // Update connection status
        updateConnectionStatus(true);
        
        console.log('✅ اپلیکیشن با موفقیت بارگذاری شد');
        
    } catch (error) {
        console.error('❌ خطا در بارگذاری اپلیکیشن:', error);
        hideLoadingScreen();
        showErrorMessage('خطا در بارگذاری داده‌ها. لطفاً فایل data.csv را بررسی کنید.');
    }
}

/**
 * Load and parse CSV data
 */
async function loadCSVData() {
    try {
        const response = await fetch('data.csv');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        csvData = parseCSV(csvText);
        
        if (csvData.length === 0) {
            throw new Error('فایل CSV خالی است');
        }
        
        console.log(`📊 ${csvData.length} ردیف داده بارگذاری شد`);
        
    } catch (error) {
        console.error('❌ خطا در بارگذاری CSV:', error);
        // Use sample data for demonstration
        csvData = generateSampleData();
        console.log('🔄 از داده‌های نمونه استفاده می‌شود');
    }
}

/**
 * Parse CSV text into array of objects
 */
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                // Convert numeric values
                const value = values[index];
                if (header !== 'Date' && header !== 'Time' && !isNaN(value)) {
                    row[header] = parseFloat(value);
                } else {
                    row[header] = value;
                }
            });
            data.push(row);
        }
    }
    
    return data;
}

/**
 * Generate sample data for demonstration
 */
function generateSampleData() {
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < 50; i++) {
        const date = new Date(now - i * 1000 * 60 * 10); // Every 10 minutes
        data.unshift({
            Date: date.toLocaleDateString('fa-IR'),
            Time: date.toLocaleTimeString('fa-IR'),
            TempC: 22 + Math.random() * 8,
            Light: 800 + Math.random() * 200,
            Gas: 200 + Math.random() * 100,
            Vibration: 5 + Math.random() * 15,
            Voltage: 220 + Math.random() * 10,
            Ultrasonic: 100 + Math.random() * 100,
            Power: 100 + Math.random() * 50,
            Current: 0.5 + Math.random() * 1,
            Sound: Math.random() > 0.9 ? 1 : 0,
            Flame: Math.random() > 0.95 ? 1 : 0
        });
    }
    
    return data;
}

/**
 * Initialize navigation system
 */
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    // Navigation item click handlers
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            switchSection(section);
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });
    
    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

/**
 * Switch between sections
 */
function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
    }
    
    // Update navigation active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    // Trigger section-specific updates
    setTimeout(() => {
        switch(sectionName) {
            case 'dashboard':
                updateDashboard();
                if (charts.temperature) {
                    charts.temperature.resize();
                    charts.temperature.update('none');
                }
                break;
            case 'environment':
                updateEnvironment();
                if (charts.light) {
                    charts.light.resize();
                    charts.light.update('none');
                }
                break;
            case 'machinery':
                updateMachinery();
                ['voltage', 'current', 'vibration'].forEach(chartName => {
                    if (charts[chartName]) {
                        charts[chartName].resize();
                        charts[chartName].update('none');
                    }
                });
                break;
            case 'security':
                updateSecurity();
                break;
        }
        
        // Force chart containers to maintain proper dimensions
        setTimeout(() => {
            document.querySelectorAll('.chart-canvas-container').forEach(container => {
                const canvas = container.querySelector('canvas');
                if (canvas && container.offsetParent !== null) { // Only visible containers
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                }
            });
        }, 50);
    }, 100);
}

/**
 * Initialize Dashboard Section
 */
function initializeDashboard() {
    updateDashboard();
    createTemperatureChart();
}

/**
 * Update Dashboard KPIs and data
 */
function updateDashboard() {
    if (csvData.length === 0) return;
    
    const latestData = csvData[csvData.length - 1];
    
    // Update KPI values
    updateKPI('tempValue', latestData.TempC, '°C', getTemperatureStatus(latestData.TempC));
    updateKPI('gasValue', latestData.Gas, 'ppm', getGasStatus(latestData.Gas));
    updateKPI('voltageValue', latestData.Voltage, 'V', getVoltageStatus(latestData.Voltage));
    
    // Update security status
    const securityStatus = getSecurityStatus(latestData);
    document.getElementById('securityValue').textContent = securityStatus.text;
    updateKPIStatus('securityStatus', securityStatus.status);
    
    // Update last updated timestamp
    updateLastUpdatedTime(latestData);
}

/**
 * Update KPI card
 */
function updateKPI(valueId, value, unit, status) {
    const valueElement = document.getElementById(valueId);
    const statusElement = document.getElementById(valueId.replace('Value', 'Status'));
    
    if (valueElement) {
        valueElement.textContent = typeof value === 'number' ? value.toFixed(1) : value;
    }
    
    if (statusElement) {
        updateKPIStatus(statusElement.id, status);
    }
}

/**
 * Update KPI status indicator
 */
function updateKPIStatus(elementId, status) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.className = `kpi-status ${status}`;
}

/**
 * Create temperature trend chart
 */
function createTemperatureChart() {
    const ctx = document.getElementById('temperatureChart');
    if (!ctx || charts.temperature) return;
    
    const labels = csvData.map(row => `${row.Time}`).slice(-20);
    const data = csvData.map(row => row.TempC).slice(-20);
    
    charts.temperature = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'دما (°C)',
                data: data,
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#58a6ff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            plugins: {
                legend: {
                    labels: {
                        color: '#f0f6fc',
                        font: { family: 'Vazirmatn' }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { 
                        color: '#8b949e', 
                        font: { family: 'Vazirmatn' },
                        maxTicksLimit: 10
                    },
                    grid: { color: 'rgba(139, 148, 158, 0.2)' }
                },
                y: {
                    ticks: { 
                        color: '#8b949e', 
                        font: { family: 'Vazirmatn' }
                    },
                    grid: { color: 'rgba(139, 148, 158, 0.2)' }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

/**
 * Initialize Environment Section
 */
function initializeEnvironment() {
    createTemperatureGauge();
    createGasGauge();
    createLightChart();
    updateEnvironment();
}

/**
 * Update Environment Section
 */
function updateEnvironment() {
    if (csvData.length === 0) return;
    
    const latestData = csvData[csvData.length - 1];
    
    // Update gauges
    updateGauge('tempGaugeValue', 'tempGaugeCanvas', latestData.TempC, 0, 50, '#58a6ff');
    updateGauge('gasGaugeValue', 'gasGaugeCanvas', latestData.Gas, 0, 500, '#7c3aed');
    
    // Update flame indicator
    updateFlameIndicator(latestData.Flame);
}

/**
 * Create temperature gauge
 */
function createTemperatureGauge() {
    const canvas = document.getElementById('tempGaugeCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 120;
    
    // This will be updated in updateGauge function
}

/**
 * Create gas gauge
 */
function createGasGauge() {
    const canvas = document.getElementById('gasGaugeCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 120;
    
    // This will be updated in updateGauge function
}

/**
 * Update gauge display
 */
function updateGauge(valueId, canvasId, value, min, max, color) {
    const valueElement = document.getElementById(valueId);
    const canvas = document.getElementById(canvasId);
    
    if (valueElement) {
        valueElement.textContent = typeof value === 'number' ? value.toFixed(1) : value;
    }
    
    if (canvas) {
        drawGauge(canvas, value, min, max, color);
    }
}

/**
 * Draw gauge on canvas
 */
function drawGauge(canvas, value, min, max, color) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 20;
    const radius = 80;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw gauge background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Draw gauge fill
    const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const angle = Math.PI * percentage;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

/**
 * Create light history chart
 */
function createLightChart() {
    const ctx = document.getElementById('lightChart');
    if (!ctx || charts.light) return;
    
    const labels = csvData.map(row => `${row.Time}`).slice(-20);
    const data = csvData.map(row => row.Light).slice(-20);
    
    charts.light = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'نور محیط (Lux)',
                data: data,
                borderColor: '#d29922',
                backgroundColor: 'rgba(210, 153, 34, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#d29922',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            plugins: {
                legend: {
                    labels: {
                        color: '#f0f6fc',
                        font: { family: 'Vazirmatn' }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { 
                        color: '#8b949e', 
                        font: { family: 'Vazirmatn' },
                        maxTicksLimit: 10
                    },
                    grid: { color: 'rgba(139, 148, 158, 0.2)' }
                },
                y: {
                    ticks: { 
                        color: '#8b949e', 
                        font: { family: 'Vazirmatn' }
                    },
                    grid: { color: 'rgba(139, 148, 158, 0.2)' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

/**
 * Update flame indicator
 */
function updateFlameIndicator(flameValue) {
    const indicator = document.getElementById('flameIndicator');
    const status = document.getElementById('flameStatus');
    
    if (flameValue === 1) {
        indicator.classList.add('active');
        status.textContent = 'هشدار آتش!';
        status.style.color = '#f85149';
    } else {
        indicator.classList.remove('active');
        status.textContent = 'عادی';
        status.style.color = '#238636';
    }
}

/**
 * Initialize Machinery Section
 */
function initializeMachinery() {
    createVoltageChart();
    createCurrentChart();
    createVibrationChart();
    updateMachinery();
}

/**
 * Update Machinery Section
 */
function updateMachinery() {
    if (csvData.length === 0) return;
    
    const latestData = csvData[csvData.length - 1];
    
    // Update machinery status
    updateMachineryStatus('motorStatus', getMotorStatus(latestData));
    updateMachineryStatus('powerStatus', getPowerStatus(latestData));
    updateMachineryStatus('ultrasonicStatus', getUltrasonicStatus(latestData));
}

/**
 * Create voltage chart
 */
function createVoltageChart() {
    const ctx = document.getElementById('voltageChart');
    if (!ctx || charts.voltage) return;
    
    const labels = csvData.map(row => `${row.Time}`).slice(-20);
    const data = csvData.map(row => row.Voltage).slice(-20);
    
    charts.voltage = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ولتاژ (V)',
                data: data,
                borderColor: '#238636',
                backgroundColor: 'rgba(35, 134, 54, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: getChartOptions()
    });
}

/**
 * Create current chart
 */
function createCurrentChart() {
    const ctx = document.getElementById('currentChart');
    if (!ctx || charts.current) return;
    
    const labels = csvData.map(row => `${row.Time}`).slice(-20);
    const data = csvData.map(row => row.Current).slice(-20);
    
    charts.current = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'جریان (A)',
                data: data,
                borderColor: '#f85149',
                backgroundColor: 'rgba(248, 81, 73, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: getChartOptions()
    });
}

/**
 * Create vibration chart
 */
function createVibrationChart() {
    const ctx = document.getElementById('vibrationChart');
    if (!ctx || charts.vibration) return;
    
    const labels = csvData.map(row => `${row.Time}`).slice(-15);
    const data = csvData.map(row => row.Vibration).slice(-15);
    
    charts.vibration = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'ارتعاشات',
                data: data,
                backgroundColor: 'rgba(124, 58, 237, 0.6)',
                borderColor: '#7c3aed',
                borderWidth: 1
            }]
        },
        options: getChartOptions()
    });
}

/**
 * Get standard chart options
 */
function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 200,
        plugins: {
            legend: {
                labels: {
                    color: '#f0f6fc',
                    font: { family: 'Vazirmatn' }
                }
            }
        },
        scales: {
            x: {
                ticks: { 
                    color: '#8b949e', 
                    font: { family: 'Vazirmatn' },
                    maxTicksLimit: 12
                },
                grid: { color: 'rgba(139, 148, 158, 0.2)' }
            },
            y: {
                ticks: { 
                    color: '#8b949e', 
                    font: { family: 'Vazirmatn' }
                },
                grid: { color: 'rgba(139, 148, 158, 0.2)' }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        elements: {
            point: {
                radius: 3,
                hoverRadius: 6
            }
        }
    };
}

/**
 * Update machinery status indicator
 */
function updateMachineryStatus(elementId, status) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.className = `status-value ${status.type}`;
    element.textContent = status.text;
}

/**
 * Initialize Security Section
 */
function initializeSecurity() {
    updateSecurity();
}

/**
 * Update Security Section
 */
function updateSecurity() {
    if (csvData.length === 0) return;
    
    updateSecurityStats();
    updateSecurityLog();
}

/**
 * Update security statistics
 */
function updateSecurityStats() {
    let totalEvents = 0;
    let soundAlerts = 0;
    let fireAlerts = 0;
    
    csvData.forEach(row => {
        if (row.Sound === 1) {
            soundAlerts++;
            totalEvents++;
        }
        if (row.Flame === 1) {
            fireAlerts++;
            totalEvents++;
        }
    });
    
    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('soundAlerts').textContent = soundAlerts;
    document.getElementById('fireAlerts').textContent = fireAlerts;
}

/**
 * Update security log
 */
function updateSecurityLog() {
    const container = document.getElementById('securityLogContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const securityEvents = [];
    
    csvData.forEach(row => {
        if (row.Sound === 1) {
            securityEvents.push({
                time: `${row.Date} ${row.Time}`,
                message: 'تشخیص صدای غیرعادی',
                type: 'warning',
                icon: '🔊'
            });
        }
        if (row.Flame === 1) {
            securityEvents.push({
                time: `${row.Date} ${row.Time}`,
                message: 'تشخیص آتش!',
                type: 'error',
                icon: '🔥'
            });
        }
    });
    
    // Sort by time (newest first)
    securityEvents.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    if (securityEvents.length === 0) {
        container.innerHTML = `
            <div class="log-item">
                <span class="log-time">--</span>
                <span class="log-message">هیچ رویداد امنیتی ثبت نشده</span>
                <span class="log-type info">اطلاعات</span>
            </div>
        `;
        return;
    }
    
    securityEvents.slice(0, 20).forEach(event => {
        const logItem = document.createElement('div');
        logItem.className = `log-item ${event.type}`;
        logItem.innerHTML = `
            <span class="log-time">${event.time}</span>
            <span class="log-message">${event.icon} ${event.message}</span>
            <span class="log-type ${event.type}">${getLogTypeText(event.type)}</span>
        `;
        container.appendChild(logItem);
    });
}

/**
 * Get log type text in Persian
 */
function getLogTypeText(type) {
    switch(type) {
        case 'info': return 'اطلاعات';
        case 'warning': return 'هشدار';
        case 'error': return 'خطر';
        default: return 'اطلاعات';
    }
}

/**
 * Status calculation functions
 */
function getTemperatureStatus(temp) {
    if (temp < 15 || temp > 35) return 'error';
    if (temp < 18 || temp > 30) return 'warning';
    return 'normal';
}

function getGasStatus(gas) {
    if (gas > 400) return 'error';
    if (gas > 300) return 'warning';
    return 'normal';
}

function getVoltageStatus(voltage) {
    if (voltage < 200 || voltage > 240) return 'error';
    if (voltage < 210 || voltage > 230) return 'warning';
    return 'normal';
}

function getSecurityStatus(data) {
    if (data.Flame === 1) {
        return { text: 'خطر آتش!', status: 'error' };
    }
    if (data.Sound === 1) {
        return { text: 'هشدار صوتی', status: 'warning' };
    }
    return { text: 'امن', status: 'normal' };
}

function getMotorStatus(data) {
    if (data.Vibration > 15) return { text: 'خطرناک', type: 'error' };
    if (data.Vibration > 10) return { text: 'هشدار', type: 'warning' };
    return { text: 'عادی', type: 'normal' };
}

function getPowerStatus(data) {
    if (data.Power < 50) return { text: 'کم', type: 'warning' };
    if (data.Power > 150) return { text: 'زیاد', type: 'warning' };
    return { text: 'عادی', type: 'normal' };
}

function getUltrasonicStatus(data) {
    if (data.Ultrasonic < 50) return { text: 'خطر', type: 'error' };
    if (data.Ultrasonic < 80) return { text: 'هشدار', type: 'warning' };
    return { text: 'عادی', type: 'normal' };
}

/**
 * Update last updated timestamp
 */
function updateLastUpdatedTime(data) {
    const element = document.getElementById('lastUpdated');
    if (!element || !data) return;
    
    const timeString = `${data.Date} ${data.Time}`;
    element.textContent = `آخرین بروزرسانی: ${timeString}`;
}

/**
 * Update connection status
 */
function updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    if (isOnline) {
        statusElement.classList.add('online');
        statusElement.querySelector('span:last-child').textContent = 'آنلاین';
    } else {
        statusElement.classList.remove('online');
        statusElement.querySelector('span:last-child').textContent = 'آفلاین';
    }
}

/**
 * Show loading screen
 */
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
}

/**
 * Hide loading screen
 */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    // Create and show error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(248, 81, 73, 0.95);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        font-family: Vazirmatn;
        font-size: 1.1rem;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(20px);
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        document.body.removeChild(errorDiv);
    }, 5000);
}

/**
 * Periodic data refresh (if needed for real-time updates)
 */
function startDataRefresh() {
    setInterval(async () => {
        try {
            await loadCSVData();
            
            // Update current section
            switch(currentSection) {
                case 'dashboard':
                    updateDashboard();
                    if (charts.temperature) {
                        updateChartData(charts.temperature, csvData.map(row => row.TempC).slice(-20));
                    }
                    break;
                case 'environment':
                    updateEnvironment();
                    if (charts.light) {
                        updateChartData(charts.light, csvData.map(row => row.Light).slice(-20));
                    }
                    break;
                case 'machinery':
                    updateMachinery();
                    break;
                case 'security':
                    updateSecurity();
                    break;
            }
            
        } catch (error) {
            console.warn('⚠️ خطا در بروزرسانی داده‌ها:', error);
            updateConnectionStatus(false);
        }
    }, 30000); // Update every 30 seconds
}

/**
 * Update chart data
 */
function updateChartData(chart, newData) {
    if (!chart || !chart.data) return;
    
    chart.data.datasets[0].data = newData;
    chart.data.labels = csvData.map(row => `${row.Time}`).slice(-newData.length);
    chart.update('none'); // Update without animation
}

/**
 * Handle window resize
 */
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Redraw gauges on resize
        if (currentSection === 'environment') {
            updateEnvironment();
        }
        
        // Update charts with proper resize
        Object.values(charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
                chart.update('none'); // Update without animation
            }
        });
        
        // Force chart containers to maintain proper dimensions
        document.querySelectorAll('.chart-canvas-container').forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = '100%';
            }
        });
    }, 250);
});

// Start periodic refresh (optional)
// startDataRefresh();