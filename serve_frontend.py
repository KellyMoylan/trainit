#!/usr/bin/env python3
"""
Simple HTTP server to serve the frontend files
This helps avoid CORS issues when testing locally
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

def serve_frontend():
    # Change to the frontend directory
    frontend_dir = Path(__file__).parent / "frontend"
    os.chdir(frontend_dir)
    
    # Set up the server
    PORT = 3000
    Handler = http.server.SimpleHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🌐 Frontend server running at http://localhost:{PORT}")
        print(f"📁 Serving files from: {frontend_dir}")
        print("Press Ctrl+C to stop the server")
        
        # Open the browser automatically
        webbrowser.open(f"http://localhost:{PORT}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    serve_frontend() 