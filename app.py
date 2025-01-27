import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
import scanner
import threading
import logging
import concurrent.futures
import atexit

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

scan_thread = None
is_scanning = False
found_servers = []
should_stop = False
current_progress = 0
total_ports = 0
current_tor_status = False
current_scan_mode = 'normal'

def ensure_logs_directory():
    if not os.path.exists('scan_logs'):
        os.makedirs('scan_logs')

def save_scan_results(target, start_port, end_port, use_tor, servers):
    ensure_logs_directory()
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    filename = f"scan_logs/scan_{timestamp}.txt"
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f"Minecraft Server Scan Results\n")
        f.write(f"==========================\n\n")
        f.write(f"Scan Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Target: {target}\n")
        f.write(f"Port Range: {start_port}-{end_port}\n")
        f.write(f"Tor Used: {'Yes' if use_tor else 'No'}\n")
        f.write(f"Servers Found: {len(servers)}\n\n")
        
        for server in servers:
            f.write(f"\nServer: {server['address']}\n")
            f.write(f"Version: {server['version']}\n")
            f.write(f"Players: {server['players']}\n")
            f.write(f"Description: {server['description']}\n")
            f.write(f"Latency: {server['latency']}\n")
            
            if server.get('is_modded'):
                f.write("Server Type: Modded\n")
            
            if server['plugins']:
                f.write("\nPlugins:\n")
                for plugin in server['plugins']:
                    f.write(f"- {plugin}\n")
            
            if server['mods']:
                f.write("\nMods:\n")
                for mod in server['mods']:
                    f.write(f"- {mod}\n")
            
            if server['player_list']:
                f.write("\nOnline Players:\n")
                for player in server['player_list']:
                    f.write(f"- {player}\n")
            
            f.write("\n" + "="*50 + "\n")

def scan_range(target, start_port, end_port, scan_mode):
    global is_scanning, should_stop, found_servers, current_progress, total_ports
    
    current_progress = 0
    total_ports = end_port - start_port + 1
    
    timeout = 2 if scan_mode == 'fast' else 5 if scan_mode == 'thorough' else 3
    max_workers = 100 if scan_mode == 'fast' else 25 if scan_mode == 'thorough' else 50
    
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            for port in range(start_port, end_port + 1):
                if should_stop:
                    break
                futures.append(executor.submit(scanner.scan_port, target, port, timeout))
            
            for future in concurrent.futures.as_completed(futures):
                if should_stop:
                    break
                current_progress += 1
                result = future.result()
                if result:
                    found_servers.append(result)
                    logging.info(f"Found server: {result['address']}")
    except Exception as e:
        logging.error(f"Scan error: {str(e)}")
    finally:
        is_scanning = False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check_tor', methods=['GET'])
def check_tor():
    success, message = scanner.setup_tor_connection()
    return jsonify({
        'success': success,
        'message': message,
        'status': 'connected' if success else 'failed'
    })

@app.route('/start_scan', methods=['POST'])
def start_scan():
    global scan_thread, is_scanning, found_servers, should_stop, current_tor_status, current_scan_mode
    
    if is_scanning:
        return jsonify({'status': 'error', 'message': 'Scan already in progress'})
    
    data = request.json
    target = data.get('target')
    start_port = int(data.get('start_port', 25565))
    end_port = int(data.get('end_port', 25565))
    use_tor = data.get('use_tor', False)
    scan_mode = data.get('scan_mode', 'normal')
    
    current_tor_status = use_tor
    current_scan_mode = scan_mode
    
    if use_tor:
        success, message = scanner.setup_tor_connection()
        if not success:
            return jsonify({'status': 'error', 'message': message})
    
    found_servers = []
    should_stop = False
    is_scanning = True
    
    scan_thread = threading.Thread(
        target=scan_range,
        args=(target, start_port, end_port, scan_mode)
    )
    scan_thread.daemon = True
    scan_thread.start()
    
    return jsonify({'status': 'success', 'message': 'Scan started'})

@app.route('/stop_scan', methods=['POST'])
def stop_scan():
    global should_stop, is_scanning, found_servers, current_tor_status
    should_stop = True
    is_scanning = False
    
    if found_servers:
        save_scan_results(
            target=found_servers[0]['address'].split(':')[0],
            start_port=min(int(s['address'].split(':')[1]) for s in found_servers),
            end_port=max(int(s['address'].split(':')[1]) for s in found_servers),
            use_tor=current_tor_status,
            servers=found_servers
        )
    
    return jsonify({'status': 'success', 'message': 'Scan stopped'})

@app.route('/scan_status')
def scan_status():
    global is_scanning, found_servers, current_progress, total_ports
    progress = (current_progress / total_ports * 100) if total_ports > 0 else 0
    
    # Сохраняем состояние сканирования в сессии
    session['scan_state'] = {
        'is_scanning': is_scanning,
        'progress': progress,
        'found_servers': found_servers,
        'current_progress': current_progress,
        'total_ports': total_ports
    }
    
    return jsonify({
        'is_scanning': is_scanning,
        'progress': progress,
        'found_servers': found_servers,
        'servers_count': len(found_servers)
    })

@app.route('/restore_scan_state')
def restore_scan_state():
    global is_scanning, found_servers, current_progress, total_ports
    
    scan_state = session.get('scan_state')
    if scan_state:
        is_scanning = scan_state['is_scanning']
        current_progress = scan_state['current_progress']
        total_ports = scan_state['total_ports']
        found_servers = scan_state['found_servers']
    
    return jsonify({
        'is_scanning': is_scanning,
        'progress': (current_progress / total_ports * 100) if total_ports > 0 else 0,
        'found_servers': found_servers,
        'servers_count': len(found_servers)
    })

@app.route('/reset_tor', methods=['POST'])
def reset_tor():
    success, message = scanner.reset_tor_connection()
    return jsonify({'status': 'success' if success else 'error', 'message': message})

def cleanup():
    global found_servers, current_tor_status
    if found_servers:
        save_scan_results(
            target=found_servers[0]['address'].split(':')[0],
            start_port=min(int(s['address'].split(':')[1]) for s in found_servers),
            end_port=max(int(s['address'].split(':')[1]) for s in found_servers),
            use_tor=current_tor_status,
            servers=found_servers
        )

atexit.register(cleanup)

# Добавим секретный ключ для сессий
app.secret_key = 'your-secret-key-here'  # Замените на случайный секретный ключ

if __name__ == '__main__':
    app.run(debug=False, port=5000, threaded=True)
