#!/bin/sh

while IFS= read -r line; do
  escaped_line=$(echo "$line" | sed 's/"/\\"/g')
  eval "echo \"$escaped_line\""
done < /garage-init/garage.toml.template > /output/garage.toml