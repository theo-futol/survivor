FROM alpine:3.20

COPY --from=bhgedigital/envsubst /usr/local/bin/envsubst /usr/local/bin/envsubst

WORKDIR /garage-init
COPY garage.toml.template .

ENTRYPOINT ["sh", "-c", "envsubst < /garage-init/garage.toml.template > /output/garage.toml"]
