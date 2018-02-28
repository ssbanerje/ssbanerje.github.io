#!/bin/bash

USER=ssbaner2
HOST=webhost.engr.illinois.edu
DIR=public_html/

# BUILD
rm -rf ${DIR}
hugo
mkdir -p public/cgi-bin
find public/ -name ".DS_Store" -delete

# MINIFY
html-minifier --input-dir public/ --output-dir public/ --collapse-whitespace --html5 --minify-css --minify-js --file-ext html
html-minifier --input-dir public/ --output-dir public/ --collapse-whitespace --minify-css --file-ext css
html-minifier --input-dir public/ --output-dir public/ --collapse-whitespace --minify-js --file-ext js

rsync -avz --delete public/ ${USER}@${HOST}:${DIR}

exit 0
