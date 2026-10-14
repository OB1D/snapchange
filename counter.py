#!/usr/bin/env python3
"""SnapChange visitor counter: zero-dependency, standard library only (http.server + sqlite3).

Endpoints (JSON, CORS-enabled for https://ob1d.github.io):
  GET /hit     count one visit, returns {"count": <all-time visits>, "unique_today": <distinct visitors today>}
  GET /stats   read-only totals (nothing is counted)
  GET /health  {"ok": true}

Usage:
  python counter.py                          serve on 127.0.0.1:8797, data in visits.db next to this file
  python counter.py --host 0.0.0.0 --port 8797 --trust-proxy
  python counter.py --origin http://localhost:8080      also allow a local copy of the app (repeatable)
  python counter.py --stats                  print visitor totals and exit (works in PowerShell)
  python counter.py --stats --json           same, as JSON

Privacy: no cookies and no raw IP addresses are stored. A visitor is identified for "unique today"
only by sha256(daily random salt + IP + User-Agent). The salt and every hash are discarded when the
day rolls over, so past days keep only aggregate counts.
"""
import argparse
import datetime
import hashlib
import json
import os
import secrets
import sqlite3
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

DEFAULT_ORIGINS = ['https://ob1d.github.io']
DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'visits.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, uniques INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS seen  (day TEXT NOT NULL, vhash TEXT NOT NULL, PRIMARY KEY (day, vhash));
CREATE TABLE IF NOT EXISTS meta  (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def today():
    return datetime.date.today().isoformat()  # server-local date


class Store:
    """All database access goes through one connection guarded by one lock."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.db = sqlite3.connect(path, check_same_thread=False, timeout=10)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript(SCHEMA)
        self.db.commit()

    def _salt(self, day):
        """Return today's salt; on a new day, forget yesterday's salt and visitor hashes."""
        row = dict(self.db.execute("SELECT key, value FROM meta WHERE key IN ('salt', 'salt_day')").fetchall())
        if row.get('salt_day') == day and row.get('salt'):
            return row['salt']
        salt = secrets.token_hex(16)
        self.db.execute('DELETE FROM seen WHERE day <> ?', (day,))
        self.db.executemany('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [('salt', salt), ('salt_day', day)])
        return salt

    def hit(self, ip, user_agent):
        day = today()
        with self.lock, self.db:
            salt = self._salt(day)
            vhash = hashlib.sha256(f'{salt}|{ip}|{user_agent}'.encode('utf-8', 'replace')).hexdigest()[:32]
            new = self.db.execute('INSERT OR IGNORE INTO seen (day, vhash) VALUES (?, ?)', (day, vhash)).rowcount == 1
            self.db.execute(
                'INSERT INTO daily (day, hits, uniques) VALUES (?, 1, ?) '
                'ON CONFLICT(day) DO UPDATE SET hits = hits + 1, uniques = uniques + excluded.uniques',
                (day, int(new)))
            count = self.db.execute('SELECT COALESCE(SUM(hits), 0) FROM daily').fetchone()[0]
            unique_today = self.db.execute('SELECT uniques FROM daily WHERE day = ?', (day,)).fetchone()[0]
        return {'count': count, 'unique_today': unique_today}

    def stats(self, days=7):
        day = today()
        with self.lock:
            total, visitor_days, first = self.db.execute(
                'SELECT COALESCE(SUM(hits), 0), COALESCE(SUM(uniques), 0), MIN(day) FROM daily').fetchone()
            t = self.db.execute('SELECT hits, uniques FROM daily WHERE day = ?', (day,)).fetchone() or (0, 0)
            recent = self.db.execute('SELECT day, hits, uniques FROM daily ORDER BY day DESC LIMIT ?', (days,)).fetchall()
        return {
            'count': total,
            'unique_today': t[1],
            'today': {'date': day, 'visits': t[0], 'unique': t[1]},
            'visitor_days': visitor_days,
            'since': first,
            'recent': [{'date': d, 'visits': h, 'unique': u} for d, h, u in recent],
        }


def make_handler(store, origins, trust_proxy, quiet):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'SnapChangeCounter/1.0'
        sys_version = ''

        def _cors(self):
            origin = self.headers.get('Origin')
            if origin and origin in origins:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                self.send_header('Access-Control-Max-Age', '86400')
            self.send_header('Vary', 'Origin')

        def _json(self, status, body):
            data = json.dumps(body, separators=(',', ':')).encode('utf-8')
            self.send_response(status)
            self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(data)

        def _client_ip(self):
            if trust_proxy:
                fwd = self.headers.get('X-Forwarded-For', '').split(',')[0].strip()
                if fwd:
                    return fwd
            return self.client_address[0]

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header('Content-Length', '0')
            self.end_headers()

        def do_GET(self):
            path = urlsplit(self.path).path.rstrip('/') or '/'
            try:
                if path == '/hit':
                    self._json(200, store.hit(self._client_ip(), self.headers.get('User-Agent', '')))
                elif path == '/stats':
                    self._json(200, store.stats())
                elif path in ('/', '/health'):
                    self._json(200, {'ok': True})
                else:
                    self._json(404, {'error': 'not found'})
            except sqlite3.Error as err:
                self.log_error('database error: %s', err)
                self._json(500, {'error': 'database error'})

        def log_message(self, fmt, *args):
            # Default logging prints client IPs; keep only the request line and status.
            if not quiet:
                sys.stderr.write('%s %s\n' % (self.log_date_time_string(), fmt % args))

    return Handler


def print_stats(store, as_json):
    s = store.stats(days=14)
    if as_json:
        print(json.dumps(s, indent=2))
        return
    print('SnapChange visitors  (%s)' % store.path)
    print('  All-time visits  : {:,}'.format(s['count']))
    print('  Today visits     : {:,}  ({})'.format(s['today']['visits'], s['today']['date']))
    print('  Unique today     : {:,}'.format(s['unique_today']))
    print('  Visitor-days     : {:,}  (sum of daily uniques)'.format(s['visitor_days']))
    print('  Counting since   : {}'.format(s['since'] or '-'))
    if s['recent']:
        print()
        print('  Date        Visits  Unique')
        for r in s['recent']:
            print('  {:<10}  {:>6,}  {:>6,}'.format(r['date'], r['visits'], r['unique']))


def main(argv=None):
    p = argparse.ArgumentParser(description='SnapChange zero-dependency visitor counter.')
    p.add_argument('--stats', action='store_true', help='print visitor totals and exit')
    p.add_argument('--json', action='store_true', help='with --stats: print JSON instead of a table')
    p.add_argument('--host', default='127.0.0.1', help='bind address (default 127.0.0.1)')
    p.add_argument('--port', type=int, default=8797, help='port (default 8797)')
    p.add_argument('--db', default=DEFAULT_DB, help='SQLite file (default visits.db next to counter.py)')
    p.add_argument('--origin', action='append', default=[], metavar='URL',
                   help='extra CORS origin to allow, e.g. http://localhost:8080 (repeatable)')
    p.add_argument('--trust-proxy', action='store_true',
                   help='take the client IP from X-Forwarded-For (only behind your own reverse proxy)')
    p.add_argument('--quiet', action='store_true', help='no request log')
    a = p.parse_args(argv)

    store = Store(a.db)
    if a.stats:
        print_stats(store, a.json)
        return 0

    origins = set(DEFAULT_ORIGINS) | {o.rstrip('/') for o in a.origin}
    try:
        httpd = ThreadingHTTPServer((a.host, a.port), make_handler(store, origins, a.trust_proxy, a.quiet))
    except OSError as err:
        print('Cannot listen on %s:%d (%s). Is something else using it? Try --port.' % (a.host, a.port, err), file=sys.stderr)
        return 1
    print('SnapChange counter on http://%s:%d  db=%s  origins=%s' % (a.host, a.port, a.db, ', '.join(sorted(origins))))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
