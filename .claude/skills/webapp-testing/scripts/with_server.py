#!/usr/bin/env python3
"""
Server lifecycle manager for webapp testing.

Usage:
    python with_server.py --server "npm run dev" --port 5173 -- python your_test.py
    python with_server.py --server "pnpm dev" --port 5173 -- pytest e2e/

Multiple servers:
    python with_server.py \
        --server "cd backend && python server.py" --port 3000 \
        --server "cd frontend && npm run dev" --port 5173 \
        -- python your_test.py

Options:
    --server CMD    Server command to run (can be repeated)
    --port PORT     Port to wait for (must follow each --server)
    --timeout SEC   Timeout waiting for server (default: 60)
    --help          Show this help message
"""

import argparse
import subprocess
import sys
import time
import socket
import signal
import os
from contextlib import contextmanager


def wait_for_port(port: int, timeout: int = 60) -> bool:
    """Wait for a port to become available."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                s.connect(('localhost', port))
                return True
        except (socket.error, ConnectionRefusedError):
            time.sleep(0.5)
    return False


@contextmanager
def managed_servers(servers: list[tuple[str, int]], timeout: int = 60):
    """Context manager that starts servers and ensures cleanup."""
    processes = []

    try:
        for cmd, port in servers:
            print(f"Starting server: {cmd} (port {port})")
            proc = subprocess.Popen(
                cmd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if hasattr(os, 'setsid') else None
            )
            processes.append((proc, port))

        # Wait for all ports
        for proc, port in processes:
            print(f"Waiting for port {port}...")
            if not wait_for_port(port, timeout):
                raise TimeoutError(f"Server on port {port} did not start within {timeout}s")
            print(f"Port {port} is ready")

        yield processes

    finally:
        # Cleanup all processes
        for proc, port in processes:
            print(f"Stopping server on port {port}...")
            try:
                if hasattr(os, 'killpg'):
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                else:
                    proc.terminate()
                proc.wait(timeout=5)
            except Exception as e:
                print(f"Warning: Error stopping server: {e}")
                proc.kill()


def main():
    parser = argparse.ArgumentParser(
        description='Manage server lifecycle for testing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--server', action='append', dest='servers',
                        help='Server command (pair with --port)')
    parser.add_argument('--port', action='append', dest='ports', type=int,
                        help='Port to wait for')
    parser.add_argument('--timeout', type=int, default=60,
                        help='Timeout in seconds (default: 60)')
    parser.add_argument('command', nargs='*',
                        help='Command to run after servers start')

    args = parser.parse_args()

    if not args.servers or not args.ports:
        parser.print_help()
        sys.exit(1)

    if len(args.servers) != len(args.ports):
        print("Error: Each --server must be paired with a --port")
        sys.exit(1)

    if not args.command:
        print("Error: No command specified after --")
        sys.exit(1)

    servers = list(zip(args.servers, args.ports))

    with managed_servers(servers, args.timeout):
        result = subprocess.run(' '.join(args.command), shell=True)
        sys.exit(result.returncode)


if __name__ == '__main__':
    main()
