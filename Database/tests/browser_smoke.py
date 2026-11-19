"""Opt-in browser smoke tests. Install Playwright and Chromium before running."""
import argparse
from contextlib import contextmanager, ExitStack
from getpass import getpass
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread
from time import monotonic, sleep
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]


def origin(url):
    parts = urlsplit(url)
    return parts.scheme, parts.hostname, parts.port


def https_url(value):
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        raise argparse.ArgumentTypeError("An HTTPS URL without credentials is required")
    return value


@contextmanager
def server(command, env, ready_url, log_path):
    with open(log_path, "w+", encoding="utf-8") as log:
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = monotonic() + 20
            while monotonic() < deadline and process.poll() is None:
                try:
                    with urlopen(ready_url, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    sleep(0.15)
            else:
                log.seek(0)
                raise RuntimeError(f"Local test server failed to start: {log.read()[-2000:]}")
            yield
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def login(page, api, username, password):
    return page.request.post(f"{api}/auth/login", data={"username": username, "password": password})


def open_game(page, url, api, username, password):
    response = login(page, api, username, password)
    assert response.status == 200, "Test login failed"
    page.goto(url)
    page.evaluate("token => sessionStorage.setItem('authentication_token', token)", response.json()["access_token"])
    page.reload()


def check_foul(browser, expect):
    site = "http://127.0.0.1:5173"
    api = "http://127.0.0.1:8000"
    with socket.socket() as port:
        port.bind(("127.0.0.1", 5173))  # Fail if another frontend is already running.
    with TemporaryDirectory() as folder, ExitStack() as stack:
        db = Path(folder) / "browser.sqlite"
        environment = {key: value for key, value in os.environ.items()
                       if key not in {"DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"}}
        environment.update(DB_TYPE="sqlite", DB_PATH=str(db), JWT_SECRET=secrets.token_hex(32),
                           VITE_API_BASE_URL="/api")
        stack.enter_context(patch.dict(os.environ, environment, clear=True))
        from Database.database.connection import DB_TYPE
        from Database.database.sqlite_schema import initialize_schema
        if DB_TYPE != "sqlite":
            raise RuntimeError("Browser foul test must use SQLite")
        connection = sqlite3.connect(db)
        try:
            initialize_schema(connection)
        finally:
            connection.close()
        with patch("dotenv.load_dotenv", return_value=False):
            from Database.api.main import app
        import uvicorn
        api_socket = stack.enter_context(socket.socket())
        api_socket.bind(("127.0.0.1", 8000))
        api_server = uvicorn.Server(uvicorn.Config(app, log_level="warning"))
        thread = Thread(target=api_server.run, kwargs={"sockets": [api_socket]}, daemon=True)
        thread.start()

        def stop_api():
            api_server.should_exit = True
            thread.join(timeout=10)

        stack.callback(stop_api)
        deadline = monotonic() + 10
        while not api_server.started and thread.is_alive() and monotonic() < deadline:
            sleep(0.05)
        if not api_server.started:
            raise RuntimeError("Local test API failed to start")
        stack.enter_context(server(["node", "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--strictPort"],
                                   os.environ.copy(), site, Path(folder) / "vite.log"))
        first = browser.new_context()
        stack.callback(first.close)
        first.route("**/*", lambda route: route.continue_() if origin(route.request.url) in {origin(site), origin(api)} else route.abort())
        page = first.new_page()
        password = secrets.token_urlsafe(18)
        response = page.request.post(api + "/auth/register", data={"username": "browser_test",
            "display_name": "Browser Test", "email": "browser-test@example.com", "password": password})
        assert response.status == 201, f"Test account creation failed (HTTP {response.status})"
        open_game(page, site + "/game.html", api, "browser_test", password)
        page.locator("#foul_button").click()
        page.locator("#next_frame").click()
        page.locator("#save_shot").click()
        expect(page.get_by_text("All confirmed shots saved to the database.", exact=True)).to_be_visible(timeout=15000)
        saved_url = page.url
        assert parse_qs(urlsplit(saved_url).query).get("game_id")
        fresh = browser.new_context()
        stack.callback(fresh.close)
        fresh.route("**/*", lambda route: route.continue_() if origin(route.request.url) in {origin(site), origin(api)} else route.abort())
        reopened = fresh.new_page()
        open_game(reopened, saved_url, api, "browser_test", password)
        expect(reopened.locator('[data-frame="1"] .frame_rolls span').first).to_have_text("F")
        expect(reopened.locator('[data-frame="1"] .frame_rolls span').first).to_have_attribute("title", "Foul \u2014 0 pins credited")
        expect(reopened.locator("#frame_title")).to_have_text("Frame 1 \u00b7 Shot 2")
        expect(reopened.locator("#pin_rack .pin:not([disabled])")).to_have_count(10)
    print("Browser foul save/reopen passed with a fresh browser context and temporary SQLite database.")


def check_email(browser, expect, args):
    assert args.username.startswith("recovery_test_"), "Use a dedicated recovery_test_ account"
    api = args.api.rstrip("/")
    old_password = getpass("Current test account password: ")
    new_password = getpass("New test account password (8-128 characters): ")
    assert 8 <= len(new_password) <= 128 and new_password != old_password
    with browser.new_context() as context:
        page = context.new_page()
        response = login(page, api, args.username, old_password)
        assert response.status == 200, "Initial test login failed"
        auth = {"Authorization": "Bearer " + response.json()["access_token"]}
        profile = page.request.get(api + "/auth/me", headers=auth)
        assert profile.status == 200 and profile.json()["email"].casefold() == args.email.casefold()
        page.goto(args.page)
        assert origin(page.url) == origin(args.page), "Unexpected recovery page redirect"
        page.locator("#recovery-email").fill(args.email)
        page.get_by_role("button", name="Send reset link").click()
        expect(page.locator("#recovery-status")).to_have_text("If an account matches that email, a reset link will be sent.")
    link = getpass("Paste the reset link received in the test inbox (hidden): ")
    assert link.partition("#")[0] == args.page and parse_qs(urlsplit(link).fragment).get("token"), "Unexpected reset link"
    with browser.new_context() as context:
        page = context.new_page()
        page.goto(link)
        assert origin(page.url) == origin(args.page), "Unexpected recovery page redirect"
        page.locator("#new-password").fill(new_password)
        page.locator("#confirm-password").fill(new_password)
        page.get_by_role("button", name="Reset password").click()
        expect(page.locator("#recovery-status")).to_contain_text("Password reset.")
        assert page.request.get(api + "/auth/me", headers=auth).status == 401
        assert login(page, api, args.username, old_password).status == 401
        assert login(page, api, args.username, new_password).status == 200
    print("Live reset email, HTTPS page, and new password verified.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest="mode", required=True)
    modes.add_parser("foul")
    email = modes.add_parser("email")
    email.add_argument("--api", type=https_url, required=True)
    email.add_argument("--page", type=https_url, required=True)
    email.add_argument("--username", required=True)
    email.add_argument("--email", required=True)
    args = parser.parse_args()
    from playwright.sync_api import expect, sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            if args.mode == "foul":
                check_foul(browser, expect)
            else:
                check_email(browser, expect, args)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
