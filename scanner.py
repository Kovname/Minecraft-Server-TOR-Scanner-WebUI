import socket
from mcstatus import JavaServer
import socks
import time
from stem.control import Controller, Signal
import logging

logging.basicConfig(level=logging.INFO)

def setup_tor_connection():
    try:
        cleanup_tor_connection()
        time.sleep(0.5)
        
        socks.set_default_proxy(socks.SOCKS5, "127.0.0.1", 9050)
        socket.socket = socks.socksocket
        
        test_sock = socks.socksocket()
        test_sock.settimeout(3)
        try:
            test_sock.connect(('check.torproject.org', 443))
            test_sock.close()
            return True, "Tor connection established"
        except Exception as e:
            return False, "Connection error"
    except Exception as e:
        return False, "Connection error"

def cleanup_tor_connection():
    try:
        socket.socket = socket._socketobject
    except:
        pass
# congrats! you found this comment! now you deserve a cookie for reading the source code! 🍪

def reset_tor_connection():
    try:
        with Controller.from_port(port=9051) as controller:
            controller.authenticate()
            controller.signal(Signal.NEWNYM)
            time.sleep(0.5)
            return True, "Tor identity reset successfully"
    except Exception as e:
        return False, f"Tor reset error: {str(e)}"

def scan_port(target, port, timeout=3):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((target, port))
        sock.close()
        
        if result == 0:
            try:
                server = JavaServer(target, port, timeout=timeout)
                status = server.status()
                query = None
                try:
                    query = server.query()
                except:
                    pass
                
                version = status.version.name if hasattr(status.version, 'name') else str(status.version)
                is_modded = any(x in version.lower() for x in ['forge', 'fabric', 'mod', 'bukkit', 'spigot', 'paper'])
                
                server_info = {
                    'address': f"{target}:{port}",
                    'version': version,
                    'players': f"{status.players.online}/{status.players.max}",
                    'description': str(status.description),
                    'latency': f"{status.latency:.0f}ms",
                    'player_list': [],
                    'plugins': [],
                    'mods': [],
                    'is_modded': is_modded
                }
                
                if query:
                    server_info['player_list'] = query.players.names if query.players.names else []
                    if hasattr(query, 'software'):
                        if hasattr(query.software, 'plugins'):
                            plugins = query.software.plugins
                            if isinstance(plugins, list):
                                for plugin in plugins:
                                    if any(x in plugin.lower() for x in ['forge', 'fabric']):
                                        server_info['mods'].append(plugin)
                                    else:
                                        server_info['plugins'].append(plugin)
                            elif isinstance(plugins, str):
                                plugin_list = plugins.split(';')
                                for plugin in plugin_list:
                                    if any(x in plugin.lower() for x in ['forge', 'fabric']):
                                        server_info['mods'].append(plugin)
                                    else:
                                        server_info['plugins'].append(plugin)
                elif hasattr(status.players, 'sample') and status.players.sample:
                    server_info['player_list'] = [player.name for player in status.players.sample]
                
                if server_info['is_modded'] and not server_info['mods']:
                    server_info['mods'].append(f"Modded ({version})")
                
                return server_info
            except:
                pass
        return None
    except:
        return None 