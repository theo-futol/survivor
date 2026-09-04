#!/bin/sh
# Render has no shared-volume init-container pattern like docker-compose's
# garage-config -> garage handoff, so config templating and the server
# itself run in the same service. Plain sh heredoc (no envsubst/apk) for
# the same reason as garage-init/entrypoint.sh: no package install at
# build or start time.
set -e

eval "cat <<GARAGE_EOF
$(cat /garage-init/garage.toml.template)
GARAGE_EOF" > /etc/garage.toml

exec /usr/local/bin/garage server --single-node --default-bucket
