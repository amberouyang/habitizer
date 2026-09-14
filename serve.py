#!/usr/bin/env python3
"""Dev server with no-cache headers so phones on LAN always get fresh files."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve Habitizer with disabled caching")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="0.0.0.0", help="Bind address (0.0.0.0 = LAN accessible)")
    args = parser.parse_args()

    handler = partial(NoCacheHandler, directory=".")
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Serving Habitizer on http://{args.bind}:{args.port}")
    print("Cache-Control: no-store (phones will get fresh files)")
    print("Open this Mac's Wi‑Fi IP from your phone, e.g. http://192.168.x.x:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
