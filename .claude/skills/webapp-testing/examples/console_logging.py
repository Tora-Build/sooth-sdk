#!/usr/bin/env python3
"""
Capture browser console logs during page interactions.

Usage:
    python console_logging.py http://localhost:5173
"""

import sys
from playwright.sync_api import sync_playwright


def capture_console(url: str):
    """Navigate to page and capture all console output."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        logs = []

        # Capture console messages
        def handle_console(msg):
            log_entry = {
                'type': msg.type,
                'text': msg.text,
                'location': msg.location
            }
            logs.append(log_entry)
            prefix = {
                'error': '❌',
                'warning': '⚠️',
                'info': 'ℹ️',
                'log': '📝'
            }.get(msg.type, '•')
            print(f"{prefix} [{msg.type.upper()}] {msg.text}")

        # Capture page errors
        def handle_error(error):
            print(f"🔥 PAGE ERROR: {error.message}")

        page.on('console', handle_console)
        page.on('pageerror', handle_error)

        print(f"Navigating to {url}...")
        print("=" * 60)

        page.goto(url)
        page.wait_for_load_state('networkidle')

        # Wait a bit for any async logs
        page.wait_for_timeout(2000)

        print("=" * 60)
        print(f"\nTotal logs captured: {len(logs)}")

        # Summary by type
        by_type = {}
        for log in logs:
            by_type[log['type']] = by_type.get(log['type'], 0) + 1

        print("\nSummary:")
        for log_type, count in sorted(by_type.items()):
            print(f"  {log_type}: {count}")

        browser.close()
        return logs


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python console_logging.py <url>")
        sys.exit(1)
    capture_console(sys.argv[1])
