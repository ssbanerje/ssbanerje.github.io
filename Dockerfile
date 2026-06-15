FROM hugomods/hugo:dart-sass-go-git-0.161.0
USER root
RUN apk add --no-cache make git
