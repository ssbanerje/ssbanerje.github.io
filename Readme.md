# My Website

## Prerequisites
- Install [`hugo`](https://gohugo.io/getting-started/installing/)

Requires the extended version of hugo which includes a SCSS/SaSS
compiler.

## Building
```bash
git submodule update --init --recursive
make
```

## Local debugging
```bash
make watch
```

## Deploying (on UIUC web pages)
```bash
make sync
```


