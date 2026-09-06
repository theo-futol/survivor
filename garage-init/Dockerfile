FROM alpine:3.20

WORKDIR /garage-init

COPY garage.toml.template .
COPY docker-entrypoint.sh .

RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]