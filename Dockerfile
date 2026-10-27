# Official Hugo image (with Dart Sass, Go and Git), pinned by digest to match CI.
FROM ghcr.io/gohugoio/hugo:v0.168.0@sha256:1fb8fe7f417abd5802d86747d297728aa48078d763159e7dff6559fe3f8bb8e7
USER root
RUN apk add --no-cache make
USER hugo
# The image's /cache belongs to uid 1000, but make runs as the host uid.
ENV HUGO_CACHEDIR=/tmp/hugo_cache
# Run `make ...` directly instead of passing it to /entrypoint.sh as hugo flags.
ENTRYPOINT []
