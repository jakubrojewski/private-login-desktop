#!/bin/sh
set -eu

[ "$(id -u)" -eq 1000 ] || { echo "handoff must run as browser UID 1000" >&2; exit 1; }
# ponytail: one short-lived WebDriver session; container stop remains the cleanup path.
exec geckodriver \
  --connect-existing \
  --host 0.0.0.0 \
  --port 4444 \
  --marionette-host 127.0.0.1 \
  --marionette-port 2828 \
  --log fatal
