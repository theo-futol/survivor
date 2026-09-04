FROM alpine:3.20

LABEL org.opencontainers.image.source="https://github.com/theo-futol/survivor"

RUN apk add --no-cache gettext

WORKDIR /garage-init
COPY garage.toml.template .

ENTRYPOINT ["sh", "-c", "envsubst < /garage-init/garage.toml.template > /output/garage.toml"]
