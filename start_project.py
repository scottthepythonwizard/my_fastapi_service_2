"""Start all three Sole sites on Archive's local server."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
SERVICES = (
    ('Archive', 8000, '/health', 'Simple Sneaker API', 'my_fastapi_service_sole_list'),
)
BASE_URL = 'http://127.0.0.1:8000'
URLS = tuple(BASE_URL + path for path in ('/archive', '/fit/', '/compare/'))


class StartupError(RuntimeError):
    pass


def request(url, headers=None, timeout=3):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=timeout) as response:
        return response.read().decode('utf-8')


def ready(service):
    name, port, route, expected, _ = service
    try:
        body = request(f'http://127.0.0.1:{port}{route}')
    except (OSError, urllib.error.URLError):
        return False
    if expected:
        try:
            payload = json.loads(body)
        except ValueError:
            raise StartupError(f'Port {port} is not serving the expected {name} API.') from None
        if payload.get('service') != expected or payload.get('status') != 'ok':
            raise StartupError(f'Port {port} belongs to another service. Close it before starting SOLE.')
        if not isinstance(payload.get('catalog_count'), int):
            raise StartupError(f'Port {port} is running an older {name} API. Close it before starting SOLE.')
    elif '<title>Sole Compare' not in body:
        raise StartupError(f'Port {port} is not serving SOLE Compare.')
    return True


def port_open(port):
    with socket.socket() as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def ensure_service(service, children, *, keep_running=False):
    name, port, _, _, directory = service
    if ready(service):
        print(f'{name}: using the running service on port {port}.', flush=True)
        return
    child = None
    if not port_open(port):
        command = [str(ROOT / 'my_fastapi_service_sole_list/.venv/Scripts/python.exe'),
                   '-m', 'uvicorn', 'api.index:app', '--host', '127.0.0.1', '--port', str(port)]
        logs = ROOT / '.local/logs'
        logs.mkdir(parents=True, exist_ok=True)
        flags = 0
        if os.name == 'nt':
            flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
                     if keep_running else subprocess.CREATE_NO_WINDOW)
        with (logs / f'{name.lower()}.log').open('a', encoding='utf-8') as log:
            options = dict(cwd=ROOT / directory, stdout=log,
                           stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                           start_new_session=keep_running and os.name != 'nt')
            if os.name == 'nt' and keep_running:
                try:
                    child = subprocess.Popen(command, creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB, **options)
                except PermissionError:
                    child = subprocess.Popen(command, creationflags=flags, **options)
            else:
                child = subprocess.Popen(command, creationflags=flags, **options)
        children.append(child)
        print(f'Starting {name}...', flush=True)
    else:
        print(f'Waiting for the existing {name} service on port {port}...', flush=True)
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if ready(service):
            print(f'{name}: ready.', flush=True)
            return
        if child is not None and child.poll() is not None:
            raise StartupError(f'{name} stopped during startup. See .local/logs/{name.lower()}.log.')
        time.sleep(0.25)
    raise StartupError(f'{name} did not become ready. Check the Supabase connection and .local/logs/{name.lower()}.log.')


def verify_data():
    key = os.environ.get('SOLE_API_KEY', 'student-api-key-123')
    try:
        archive = json.loads(request(BASE_URL + '/api/v1/catalog', {'x-api-key': key}, 20))
        fit = json.loads(request(BASE_URL + '/fit/api/catalog', timeout=20))
        if archive['items'] != fit['items']:
            raise ValueError('Archive and Fit catalogs differ.')
        if '<title>Sole Compare' not in request(BASE_URL + '/compare/'):
            raise ValueError('Compare page is unavailable.')
    except urllib.error.HTTPError as error:
        if error.code == 404:
            raise StartupError('Port 8000 is running an older Archive. Close that server and reopen START_SOLE.cmd.') from None
        raise StartupError(f'Could not verify the shared catalog (HTTP {error.code}).') from None
    except (OSError, ValueError, KeyError):
        raise StartupError('Could not verify the shared catalog. Check Supabase connectivity and private .env settings.') from None
    print(f"Supabase catalogs verified: Archive {archive['count']} pairs; SoleFit {fit['count']} pairs.", flush=True)


def stop_children(children):
    for child in reversed(children):
        if child.poll() is not None:
            continue
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=15)
        else:
            child.terminate()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--check', action='store_true', help='Read-only check of existing services')
    parser.add_argument('--keep-running', action='store_true', help='Leave verified services running in the background')
    args = parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env', override=False)
    children = []
    started = False
    try:
        if args.check:
            for service in SERVICES:
                if not ready(service):
                    raise StartupError(f'{service[0]} is not running. Open START_SOLE.cmd.')
            verify_data()
            return 0
        print('Starting SOLE...', flush=True)
        for service in SERVICES:
            ensure_service(service, children, keep_running=args.keep_running)
        verify_data()
        print('\nAll three apps are ready:', flush=True)
        for url in URLS:
            print('  ' + url, flush=True)
            if not args.no_browser:
                webbrowser.open(url)
        if args.keep_running:
            started = True
            return 0
        print('\nPress Ctrl+C in this window to stop the services started here.', flush=True)
        while True:
            if any(child.poll() is not None for child in children):
                raise StartupError('A local service stopped. Check .local/logs, then reopen START_SOLE.cmd.')
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nStopping the services started by this launcher.', flush=True)
        return 0
    except (StartupError, OSError) as error:
        print(f'\nUnable to start SOLE: {error}', flush=True)
        return 1
    finally:
        if not started:
            stop_children(children)


if __name__ == '__main__':
    raise SystemExit(main())
