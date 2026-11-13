#!/bin/sh
# Serve the LapFit simulation locally: http://localhost:8765
cd "$(dirname "$0")" && exec python3 -m http.server 8765 --bind 127.0.0.1
