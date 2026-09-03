FROM alpine:3.20

RUN apk add --no-cache gettext

WORKDIR /garage-init
COPY garage.toml.template .

ENTRYPOINT ["sh", "-c", "envsubst < /garage-init/garage.toml.template > /output/garage.toml"]
