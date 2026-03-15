# CC Services

Collection of self-hosted microservices.

## Services

| Service | Description |
|---|---|
| [divkit-preview](divkit-preview/) | Renders DivKit layouts to PNG screenshots via HTTP API |

## Quick start

```bash
docker compose up -d
```

## Docker Compose

```yaml
services:
  divkit-preview:
    image: ghcr.io/<owner>/cc/divkit-preview:latest
    environment:
      - SCREENSHOT_CONCURRENCY=5
    shm_size: "512mb"
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.divkit.rule=Host(`preview.example.com`)"
      - "traefik.http.routers.divkit.entrypoints=websecure"
      - "traefik.http.routers.divkit.tls.certresolver=letsencrypt"
      - "traefik.http.services.divkit.loadbalancer.server.port=8080"

  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=you@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - acme:/acme
    restart: unless-stopped

volumes:
  acme:
```

Replace `preview.example.com` with your domain and `you@example.com` with your email for Let's Encrypt.
