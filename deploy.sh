#!/bin/bash

USER=ssbaner2
HOST=webhost.engr.illinois.edu
DIR=public_html/

# BUILD
rm -rf public/ resources/
hugo --minify
mkdir -p public/cgi-bin
find . -name ".DS_Store" -delete

rsync -avz --delete public/ ${USER}@${HOST}:${DIR}

exit 0
