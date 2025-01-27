document.addEventListener('DOMContentLoaded', () => {
    const scanForm = document.getElementById('scanForm');
    const pauseScanBtn = document.getElementById('pauseScan');
    const serverList = document.getElementById('serverList');
    const torToggle = document.getElementById('useTor');
    const torStatus = document.getElementById('torStatus');
    const scanMode = document.getElementById('scanMode');
    const portRange = document.getElementById('portRange');
    const startPort = document.getElementById('startPort');
    const endPort = document.getElementById('endPort');
    const progressBar = document.getElementById('scanProgress');
    const progressText = document.getElementById('progressText');
    const serversCount = document.getElementById('serversCount');
    const modal = document.getElementById('serverModal');
    const modalClose = document.querySelector('.close');
    const pauseIcon = document.querySelector('.pause-icon');
    const playIcon = document.querySelector('.play-icon');

    let isScanning = false;
    let isPaused = false;
    let scanInterval;
    let currentServers = [];
    let openedServers = new Set();
    let knownServers = new Set();
    const newServerSound = new Audio('/static/sounds/new.mp3');
    let checkingAllServers = false;
    let serverStates = {};
    let allPlayersList = {};  // Для хранения всех игроков по серверам

    modalClose.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };

    function showServerDetails(server) {
        openedServers.add(server.address);
        const row = document.querySelector(`[data-server="${server.address}"]`);
        if (row) {
            const indicator = row.querySelector('.new-server-indicator');
            if (indicator) {
                indicator.remove();
            }
        }

        modalTitle.innerHTML = `
            <div class="modal-title-content">
                <span class="copyable-address">${server.address}
                    <button class="copy-btn" onclick="copyToClipboard('${server.address}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </span>
            </div>
        `;
        
        const checkServerBtn = document.getElementById('checkServerBtn');
        checkServerBtn.onclick = async () => {
            checkServerBtn.classList.add('checking');
            checkServerBtn.disabled = true;
            await checkServer(server, true);
            checkServerBtn.classList.remove('checking');
            checkServerBtn.disabled = false;
        };

        updateServerModal(server);
        modal.style.display = "block";
    }

    function updateServerModal(server) {
        const basicInfo = document.getElementById('basicInfo');
        const playerList = document.getElementById('playerList');
        const additionalInfo = document.getElementById('additionalInfo');

        basicInfo.innerHTML = `
            <h3>Basic Information</h3>
            <div class="info-grid">
                <p><strong>Version:</strong> ${server.version}</p>
                <p><strong>Description:</strong> ${cleanMinecraftText(server.description)}</p>
                <p><strong>Latency:</strong> ${server.latency}</p>
                <p><strong>Players:</strong> ${server.players}</p>
                <p><strong>Status:</strong> <span class="${server.isOnline ? 'online' : 'offline'}">${server.isOnline ? 'Online' : 'Offline'}</span></p>
            </div>
        `;

        if (server.player_list && server.player_list.length > 0) {
            playerList.innerHTML = server.player_list
                .map(player => `
                    <div class="player-item ${player.online ? '' : 'offline'}" 
                         onclick="copyToClipboard('${player.name}')">
                        ${cleanMinecraftText(player.name)}
                    </div>
                `)
                .join('');
        } else {
            playerList.innerHTML = '<p>No players found</p>';
        }

        let additionalHtml = '<h3>Additional Information</h3><div class="info-grid">';
        if (server.plugins && server.plugins.length > 0) {
            additionalHtml += `<p><strong>Plugins:</strong> ${server.plugins.map(p => cleanMinecraftText(p)).join(', ')}</p>`;
        }
        if (server.mods && server.mods.length > 0) {
            additionalHtml += `<p><strong>Mods:</strong> ${server.mods.map(m => cleanMinecraftText(m)).join(', ')}</p>`;
        }
        additionalHtml += '</div>';
        additionalInfo.innerHTML = additionalHtml;
    }

    portRange.addEventListener('change', () => {
        switch(portRange.value) {
            case 'default':
                startPort.value = '25565';
                endPort.value = '25565';
                break;
            case 'extended':
                startPort.value = '25500';
                endPort.value = '25600';
                break;
            case 'manual':
                break;
        }
    });

    pauseScanBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            pauseIcon.style.display = 'none';
            playIcon.style.display = 'block';
        } else {
            pauseIcon.style.display = 'block';
            playIcon.style.display = 'none';
        }
    });

    torToggle.addEventListener('change', async () => {
        if (torToggle.checked) {
            torStatus.textContent = 'Connecting...';
            torStatus.style.color = '#ffa500';
            torToggle.disabled = true;
            
            try {
                torStatus.textContent = 'Initializing Tor...';
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                torStatus.textContent = 'Checking connection...';
                const response = await fetch('/check_tor');
                const data = await response.json();
                
                if (data.success) {
                    torStatus.textContent = 'Connected';
                    torStatus.style.color = '#4CAF50';
                } else {
                    torStatus.textContent = data.message || 'Connection failed';
                    torStatus.style.color = '#f44336';
                    torToggle.checked = false;
                }
            } catch (error) {
                console.error('Tor connection error:', error);
                torStatus.textContent = 'Connection failed';
                torStatus.style.color = '#f44336';
                torToggle.checked = false;
            } finally {
                torToggle.disabled = false;
            }
        } else {
            torStatus.textContent = 'Disabled';
            torStatus.style.color = '#888';
        }
    });

    function startScan() {
        isScanning = true;
        document.getElementById('startScan').textContent = 'Stop';
        document.getElementById('pauseScan').disabled = false;
        pauseIcon.style.display = 'block';
        playIcon.style.display = 'none';
    }

    function stopScan() {
        return fetch('/stop_scan', {
            method: 'POST',
        }).then(response => {
            if (response.ok) {
                isScanning = false;
                document.getElementById('startScan').textContent = 'Start Scan';
                document.getElementById('pauseScan').disabled = true;
                pauseIcon.style.display = 'block';
                playIcon.style.display = 'none';
                if (scanInterval) {
                    clearInterval(scanInterval);
                    scanInterval = null;
                }
                progressText.textContent = 'Scan stopped';
                saveState();
            } else {
                throw new Error('Failed to stop scan');
            }
        });
    }

    scanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isScanning) {
            try {
                await stopScan();
            } catch (error) {
                progressText.textContent = `Error stopping scan: ${error.message}`;
            }
            return;
        }

        const target = document.getElementById('target').value;
        const mode = scanMode.value;
        const start = parseInt(startPort.value);
        const end = parseInt(endPort.value);
        const useTorValue = torToggle.checked;

        startScan();
        pauseScanBtn.style.display = 'inline-block';

        try {
            const response = await fetch('/start_scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target,
                    start_port: start,
                    end_port: end,
                    scan_mode: mode,
                    use_tor: useTorValue
                })
            });

            if (response.ok) {
                progressText.textContent = 'Scanning...';
                scanInterval = setInterval(checkScanStatus, 1000);
            } else {
                throw new Error('Failed to start scan');
            }
        } catch (error) {
            progressText.textContent = `Error: ${error.message}`;
            stopScan();
        }
    });

    async function checkScanStatus() {
        if (isPaused) return;

        try {
            const response = await fetch('/scan_status');
            const data = await response.json();

            progressBar.style.width = `${data.progress}%`;
            progressText.textContent = `Scanning... ${Math.round(data.progress)}%`;
            serversCount.textContent = data.servers_count;

            if (data.servers_count > 0) {
                currentServers = data.found_servers;
                updateServerList(currentServers);
            }

            if (!data.is_scanning) {
                stopScan();
                clearInterval(scanInterval);
                progressText.textContent = data.servers_count > 0 
                    ? `Scan complete! Found ${data.servers_count} servers` 
                    : 'Scan complete! No servers found';
            }
        } catch (error) {
            console.error('Error checking scan status:', error);
            progressText.textContent = 'Error checking scan status';
        }
    }

    function cleanMinecraftText(text) {
        return text.replace(/§[0-9a-fk-or]/gi, '');
    }

    function updateServerList(servers) {
        serverList.innerHTML = '';
        currentServers = servers.map(server => {
            if (serverStates[server.address]) {
                return { ...server, ...serverStates[server.address] };
            }
            // Инициализируем новый сервер с правильным форматом данных
            if (!allPlayersList[server.address]) {
                allPlayersList[server.address] = new Map();
            }
            if (server.player_list) {
                server.player_list.forEach(player => {
                    allPlayersList[server.address].set(player, true);
                });
            }
            return {
                ...server,
                isOnline: true,
                player_list: Array.from(allPlayersList[server.address].entries()).map(([name, isOnline]) => ({
                    name: name,
                    online: isOnline
                }))
            };
        });
        
        currentServers.forEach(server => {
            if (!knownServers.has(server.address)) {
                knownServers.add(server.address);
                newServerSound.play().catch(e => console.log('Error playing sound:', e));
            }

            const row = document.createElement('tr');
            row.className = 'server-row';
            row.setAttribute('data-server', server.address);
            row.onclick = () => showServerDetails(server);
            
            const indicator = !openedServers.has(server.address) ? '<span class="new-server-indicator"></span>' : '';
            const pingClass = server.isOnline === false ? 'ping-cell offline' : 'ping-cell';
            
            row.innerHTML = `
                <td>${server.address}</td>
                <td>${server.version}</td>
                <td>${cleanMinecraftText(server.description)}</td>
                <td>${server.players}</td>
                <td class="${pingClass}">${server.latency}${indicator}</td>
            `;
            
            serverList.appendChild(row);
        });
        
        serversCount.textContent = currentServers.length;
        updateCheckAllButton();
        saveState();
    }

    window.copyToClipboard = async function(text) {
        try {
            await navigator.clipboard.writeText(text);
            const tooltip = document.createElement('div');
            tooltip.className = 'copy-tooltip';
            tooltip.textContent = 'Copied!';
            document.body.appendChild(tooltip);
            
            setTimeout(() => {
                tooltip.remove();
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    window.showServerDetails = showServerDetails;

    async function checkServer(server, updateUI = true) {
        try {
            const address = server.address.split(':');
            const host = address[0];
            const port = address[1] || '25565';
            
            const response = await fetch(`https://api.mcstatus.io/v2/status/java/${host}:${port}`);
            const data = await response.json();
            
            // Инициализируем список игроков для сервера, если его еще нет
            if (!allPlayersList[server.address]) {
                allPlayersList[server.address] = new Map();
            }

            // Обновляем статус существующих игроков на оффлайн
            allPlayersList[server.address].forEach((status, player) => {
                allPlayersList[server.address].set(player, false);
            });

            // Обновляем или добавляем онлайн игроков
            if (data.online && data.players.list) {
                data.players.list.forEach(player => {
                    allPlayersList[server.address].set(player.name_clean, true);
                });
            }
            
            serverStates[server.address] = {
                isOnline: data.online,
                players: data.online ? `${data.players.online}/${data.players.max}` : server.players,
                version: data.online ? data.version.name_clean : server.version,
                description: data.online ? data.motd.clean : server.description,
                player_list: Array.from(allPlayersList[server.address].entries()).map(([name, isOnline]) => ({
                    name: name,
                    online: isOnline
                }))
            };
            
            Object.assign(server, serverStates[server.address]);
            
            if (updateUI) {
                updateServerUI(server);
            }
            
            saveState();
            return data.online;
        } catch (error) {
            console.error('Server check error:', error);
            serverStates[server.address] = { isOnline: false };
            server.isOnline = false;
            if (updateUI) {
                updateServerUI(server);
            }
            return false;
        }
    }

    function updateServerUI(server) {
        const row = document.querySelector(`[data-server="${server.address}"]`);
        if (row) {
            const cells = row.getElementsByTagName('td');
            cells[2].textContent = cleanMinecraftText(server.description);
            cells[3].textContent = server.players;
            const pingCell = cells[4];
            const indicator = pingCell.querySelector('.new-server-indicator');
            pingCell.className = server.isOnline ? 'ping-cell' : 'ping-cell offline';
            pingCell.innerHTML = `${server.latency}${indicator ? indicator.outerHTML : ''}`;
        }
        
        if (modal.style.display === "block" && modalTitle.textContent.includes(server.address)) {
            updateServerModal(server);
        }
    }

    document.getElementById('checkAllServers').addEventListener('click', async function() {
        if (checkingAllServers || currentServers.length === 0) return;
        
        const button = this;
        button.classList.add('checking');
        button.disabled = true;
        checkingAllServers = true;
        
        try {
            for (const server of currentServers) {
                if (!checkingAllServers) break;
                await checkServer(server, true);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } finally {
            button.classList.remove('checking');
            button.disabled = currentServers.length === 0;
            checkingAllServers = false;
        }
    });

    function updateCheckAllButton() {
        const button = document.getElementById('checkAllServers');
        button.disabled = currentServers.length === 0;
    }

    document.getElementById('downloadLogs').addEventListener('click', async function() {
        const button = this;
        if (button.classList.contains('loading')) return;
        
        button.classList.add('loading');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner"></i> Loading logs...';
        
        try {
            const response = await fetch('/get_logs');
            const data = await response.json();
            
            if (data.logs && data.logs.length > 0) {
                // Создаем содержимое ZIP файла
                const zip = new JSZip();
                
                // Добавляем каждый лог в ZIP
                data.logs.forEach(log => {
                    zip.file(log.filename, log.content);
                });
                
                // Генерируем ZIP файл
                const content = await zip.generateAsync({type: "blob"});
                
                // Создаем ссылку для скачивания
                const downloadUrl = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `minecraft_scan_logs_${new Date().toISOString().split('T')[0]}.zip`;
                
                // Запускаем скачивание
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Очищаем URL
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            } else {
                throw new Error('No logs found');
            }
        } catch (error) {
            console.error('Error downloading logs:', error);
            alert('Failed to download logs. No scan logs found or an error occurred.');
        } finally {
            button.classList.remove('loading');
            button.innerHTML = originalText;
        }
    });

    function saveState() {
        const state = {
            currentServers,
            openedServers: Array.from(openedServers),
            knownServers: Array.from(knownServers),
            serverStates,
            allPlayersList: Object.fromEntries(
                Object.entries(allPlayersList).map(([key, value]) => [
                    key,
                    Array.from(value.entries())
                ])
            ),
            isScanning,
            scanProgress: progressBar.style.width,
            scanText: progressText.textContent
        };
        localStorage.setItem('scannerState', JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem('scannerState');
        if (savedState) {
            const state = JSON.parse(savedState);
            currentServers = state.currentServers;
            openedServers = new Set(state.openedServers);
            knownServers = new Set(state.knownServers);
            serverStates = state.serverStates;
            allPlayersList = Object.fromEntries(
                Object.entries(state.allPlayersList).map(([key, value]) => [
                    key,
                    new Map(value)
                ])
            );
            isScanning = state.isScanning;
            
            // Восстанавливаем UI
            progressBar.style.width = state.scanProgress;
            progressText.textContent = state.scanText;
            updateServerList(currentServers);
            
            // Если сканирование было активно, возобновляем проверку статуса
            if (isScanning) {
                scanInterval = setInterval(checkScanStatus, 1000);
                document.getElementById('startScan').textContent = 'Stop';
                document.getElementById('pauseScan').disabled = false;
            }
        }
    }

    loadState();  // Загружаем сохраненное состояние
    
    // Добавим сохранение состояния перед закрытием страницы
    window.addEventListener('beforeunload', saveState);
});
