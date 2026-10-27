FROM hugomods/hugo:dart-sass-go-git-0.165.0
ARG HUGO_VERSION=0.168.0
ARG TARGETARCH
USER root
RUN apk add --no-cache make git gcompat libstdc++ && \
    wget -qO /tmp/hugo.tar.gz "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-${TARGETARCH}.tar.gz" && \
    wget -qO /tmp/checksums.txt "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_checksums.txt" && \
    grep "  hugo_extended_${HUGO_VERSION}_linux-${TARGETARCH}.tar.gz$" /tmp/checksums.txt | sed "s|  .*|  /tmp/hugo.tar.gz|" | sha256sum -c - && \
    tar -xzf /tmp/hugo.tar.gz -C /usr/bin hugo && \
    rm -f /tmp/hugo.tar.gz /tmp/checksums.txt
