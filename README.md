# Minecraft Server Scanner
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/) [![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/Kovname/Minecraft-Server-TOR-Scanner/blob/main/LICENSE) [![Tor](https://img.shields.io/badge/Tor-Supported-green.svg)](https://www.torproject.org/)

A web-based tool for scanning and discovering Minecraft servers with Tor support. This scanner allows you to find Minecraft servers across specified IP addresses and port ranges while maintaining anonymity through Tor network.

![WebUI](https://i.ibb.co/jv6tQfV/sc1.png)
![WebUI](https://i.ibb.co/NtV193f/sc2.png)

## Features

- 🌐 Web interface for easy interaction
- 🔍 Flexible port scanning options
- 🧩 Detection of modded servers and plugins
- 🕵️ Tor network support for anonymous scanning
- 📊 Real-time scanning progress
- 📝 Detailed scan logs with server information
- 🚀 Multiple scanning modes (Fast/Normal/Thorough)
- 🔔 Sound notifications for found servers
- 🔵 Unread servers indicator
- 📁 Automatic scan logs with timestamps
- 🕒 Detailed server information preservation

## Installation

1. Clone the repository:
```
git clone https://github.com/Kovname/Minecraft-Server-TOR-Scanner.git
cd Minecraft-Server-TOR-Scanner
```
2. Install dependencies:

`pip install -r requirements.txt`

3. Configure Tor:
   - Install Tor Browser or Tor service
   - Ensure Tor is running on ports 9050 (SOCKS) and 9051 (Control)
   - Add these lines to your torrc file
```
SocksPort 9050
ControlPort 9051
CookieAuthentication 1
MaxCircuitDirtiness 10
NewCircuitPeriod 5
```

## Usage

1. Start the application:

`python app.py`

2. Open the web interface in your browser:

> http://localhost:5000


3. In the web interface:
   - Enter target IP address
   - Select port range
   - Choose scan mode
   - Toggle Tor usage if needed
   - Start scanning

4. View results in real-time and check scan_logs folder for detailed reports

## License and Credits

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

This project uses the following open-source components:

- [MCStatus](https://github.com/py-mine/mcstatus) - MIT License
- [Stem](https://stem.torproject.org/) - LGPL-3.0 License
- [Flask](https://flask.palletsprojects.com/) - BSD-3-Clause License

## Security Notice

⚠️ Please note:
- Use responsibly and ethically
- Respect server owners' privacy
- Follow local laws and regulations
- Some countries may restrict Tor usage

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## Disclaimer

This tool is for educational purposes only. Users are responsible for complying with applicable laws and regulations.

