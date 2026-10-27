# Subho Sankar Banerjee — Personal Website

Source for [ssbanerje.github.io](https://ssbanerje.github.io), built with [Hugo](https://gohugo.io/) (`v0.168.0`, with Dart Sass) and [Bulma](https://bulma.io/) via Hugo Modules.

## Make targets

| Docker (recommended) | Native (needs Hugo, Dart Sass, Go, Git) | What it does |
|---|---|---|
| `make docker-all` | `make all` | Build the site into `public/` |
| `make docker-clean` | `make clean` | Remove `public/` and `resources/` |
| `make docker-watch` | `make watch` | Live-reload preview at `http://localhost:1313` |

`make docker-image` builds the Docker image on its own; the other Docker targets that need it build it first.

## Deployment
Pushes to `master` build the site and deploy it via GitHub Actions (`actions/deploy-pages` in `.github/workflows/gh-pages.yml`).
