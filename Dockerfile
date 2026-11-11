# Official Hugo image (with Dart Sass, Go and Git), pinned by digest to match CI.
FROM ghcr.io/gohugoio/hugo:v0.169.0@sha256:a146e0639230bbc73358e6563240f0a6103466f0390b80a457c775068ec802a9
USER root
RUN apk add --no-cache make
USER hugo
# The image's /cache belongs to uid 1000, but make runs as the host uid.
ENV HUGO_CACHEDIR=/tmp/hugo_cache
# Run `make ...` directly instead of passing it to /entrypoint.sh as hugo flags.
ENTRYPOINT []
