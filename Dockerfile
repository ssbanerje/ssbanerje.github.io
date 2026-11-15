# Official Hugo image (with Dart Sass, Go, Node.js and Git), matching CI.
FROM ghcr.io/gohugoio/hugo:v0.169.0
USER root
RUN apk add --no-cache make
USER hugo
# The image's /cache belongs to uid 1000, but make runs as the host uid.
ENV HUGO_CACHEDIR=/tmp/hugo_cache
ENV GOFLAGS=-modcacherw
ENV NPM_CONFIG_CACHE=/tmp/npm_cache
# Run `make ...` directly instead of passing it to /entrypoint.sh as hugo flags.
ENTRYPOINT []
