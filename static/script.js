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
        const basicInfo = document.getElementById('basicInfo');
        const playerList = document.getElementById('playerList');
        const additionalInfo = document.getElementById('additionalInfo');
        const modalTitle = document.getElementById('modalTitle');

        modalTitle.innerHTML = `Server Details - <span class="copyable-address">${server.address}<button class="copy-btn" onclick="copyToClipboard('${server.address}')"><i class="fas fa-copy"></i></button></span>`;
        
        const cleanDescription = server.description.replace(/§[0-9a-fk-or]/gi, '');

        basicInfo.innerHTML = `
            <p><strong>Version:</strong> ${server.version}</p>
            <p><strong>Description:</strong> ${cleanDescription}</p>
            <p><strong>Latency:</strong> ${server.latency}</p>
            <p><strong>Players:</strong> ${server.players}</p>
        `;

        if (server.player_list && server.player_list.length > 0) {
            playerList.innerHTML = server.player_list
                .map(player => `<div class="player-item copyable-nick" onclick="copyToClipboard('${player}')">${player}</div>`)
                .join('');
        } else {
            playerList.innerHTML = '<p>No players online</p>';
        }

        let additionalHtml = '';
        if (server.plugins) {
            additionalHtml += `<p><strong>Plugins:</strong> ${server.plugins.join(', ')}</p>`;
        }
        if (server.mods) {
            additionalHtml += `<p><strong>Mods:</strong> ${server.mods.join(', ')}</p>`;
        }
        additionalInfo.innerHTML = additionalHtml || '<p>No additional information available</p>';

        modal.style.display = "block";
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
        currentServers = servers;
        
        servers.forEach(server => {
            if (!knownServers.has(server.address)) {
                knownServers.add(server.address);
                newServerSound.play().catch(e => console.log('Error playing sound:', e));
            }

            const row = document.createElement('tr');
            row.className = 'server-row';
            row.setAttribute('data-server', server.address);
            row.onclick = () => showServerDetails(server);
            
            const indicator = !openedServers.has(server.address) ? '<span class="new-server-indicator"></span>' : '';
            
            row.innerHTML = `
                <td>${server.address}</td>
                <td>${server.version}</td>
                <td>${cleanMinecraftText(server.description)}</td>
                <td>${server.players}</td>
                <td>${server.latency}${indicator}</td>
            `;
            
            serverList.appendChild(row);
        });
        
        serversCount.textContent = servers.length;
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
});
