ARG THOUGHTS_VERSION="0.1.0"

# Pull binary
FROM alpine:latest AS setup

ARG THOUGHTS_VERSION

RUN apk add wget tar

WORKDIR /app

RUN wget -qO /app/thoughts.tar.gz "https://github.com/ellgreen/thoughts/releases/download/${THOUGHTS_VERSION}/thoughts_Linux_x86_64.tar.gz" && \
    tar -xzf thoughts.tar.gz && \
    chmod +x thoughts && \
    mv thoughts /thoughts

# Final Image
FROM alpine:latest

COPY --from=setup /thoughts /usr/local/bin/

RUN mkdir -p /data

EXPOSE 3000

CMD ["thoughts", "-addr", ":3000", "-data", "/data"]
