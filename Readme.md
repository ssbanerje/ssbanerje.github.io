# Subho Sankar Banerjee — Personal Website

Source for [ssbanerje.github.io](https://ssbanerje.github.io), built with [Hugo](https://gohugo.io/) (`v0.168+` extended with Dart Sass) and [Bulma](https://bulma.io/) via Hugo Modules.

## Building (Docker)
```bash
make docker-all
```

## Clean Build Artifacts
```bash
make docker-clean
```

## Local Live-Reload Preview (`http://localhost:1313`)
```bash
make docker-watch
```

## Deployment
Pushes to `master` build the site inside Docker and deploy automatically via GitHub Actions (`actions/deploy-pages@v4` in `.github/workflows/gh-pages.yml`).
