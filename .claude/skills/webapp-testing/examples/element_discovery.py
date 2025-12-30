#!/usr/bin/env python3
"""
Discover interactive elements on a page.

Usage:
    python element_discovery.py http://localhost:5173
"""

import sys
from playwright.sync_api import sync_playwright


def discover_elements(url: str):
    """Discover buttons, links, inputs, and other interactive elements."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print(f"Navigating to {url}...")
        page.goto(url)
        page.wait_for_load_state('networkidle')

        # Take screenshot for visual inspection
        screenshot_path = '/tmp/page_discovery.png'
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved: {screenshot_path}")

        # Discover buttons
        buttons = page.locator('button').all()
        print(f"\n=== Buttons ({len(buttons)}) ===")
        for btn in buttons[:10]:  # Limit output
            text = btn.text_content().strip()[:50] if btn.text_content() else ""
            test_id = btn.get_attribute('data-testid') or ""
            print(f"  - {text or '[no text]'} {f'[data-testid={test_id}]' if test_id else ''}")

        # Discover links
        links = page.locator('a').all()
        print(f"\n=== Links ({len(links)}) ===")
        for link in links[:10]:
            text = link.text_content().strip()[:50] if link.text_content() else ""
            href = link.get_attribute('href') or ""
            print(f"  - {text or '[no text]'} → {href[:50]}")

        # Discover inputs
        inputs = page.locator('input, textarea, select').all()
        print(f"\n=== Inputs ({len(inputs)}) ===")
        for inp in inputs[:10]:
            input_type = inp.get_attribute('type') or inp.evaluate('el => el.tagName.toLowerCase()')
            name = inp.get_attribute('name') or inp.get_attribute('placeholder') or ""
            test_id = inp.get_attribute('data-testid') or ""
            print(f"  - [{input_type}] {name} {f'[data-testid={test_id}]' if test_id else ''}")

        # Discover elements with data-testid
        testids = page.locator('[data-testid]').all()
        print(f"\n=== Elements with data-testid ({len(testids)}) ===")
        for el in testids[:20]:
            test_id = el.get_attribute('data-testid')
            tag = el.evaluate('el => el.tagName.toLowerCase()')
            print(f"  - {tag}[data-testid={test_id}]")

        browser.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python element_discovery.py <url>")
        sys.exit(1)
    discover_elements(sys.argv[1])
