# DivKit Preview Service

Renders [DivKit](https://divkit.tech/) layouts to PNG screenshots via an HTTP API.

## Quick start

### Build locally

```bash
docker build -t divkit-preview divkit-preview/
docker run -p 8080:8080 --shm-size=512m divkit-preview
```

### Pull from GHCR

```bash
docker pull ghcr.io/<owner>/cc/divkit-preview:latest
docker run -p 8080:8080 --shm-size=512m ghcr.io/<owner>/cc/divkit-preview:latest
```

Replace `<owner>` with your GitHub username or organization.

### Take a screenshot

```bash
curl -X POST http://localhost:8080/preview.png \
  -H "Content-Type: application/json" \
  -d '{"card":{"log_id":"test","states":[{"state_id":0,"div":{"type":"text","text":"Hello!","font_size":20}}]}}' \
  -o preview.png
```

With custom viewport width and retina scale:

```bash
curl -X POST "http://localhost:8080/preview.png?width=768&scale=3.0" \
  -H "Content-Type: application/json" \
  -d @layout.json \
  -o preview.png
```

## Deploy

### Docker (any host)

```bash
docker run -d \
  --name divkit-preview \
  -p 8080:8080 \
  -e SCREENSHOT_CONCURRENCY=5 \
  --shm-size=512m \
  --restart unless-stopped \
  ghcr.io/<owner>/cc/divkit-preview:latest
```

### Docker Compose

```yaml
services:
  divkit-preview:
    image: ghcr.io/<owner>/cc/divkit-preview:latest
    ports:
      - "8080:8080"
    environment:
      - SCREENSHOT_CONCURRENCY=5
    restart: unless-stopped
    shm_size: "512mb"
```

```bash
docker compose up -d
```

### Docker Compose + Traefik reverse proxy

```yaml
services:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
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

volumes:
  acme:
```

Replace `preview.example.com` with your domain and point its DNS A record to your server IP.

### Cloudflare Tunnel (no open ports)

Cloudflare Tunnel lets you expose the service without opening any inbound ports. Traffic goes through Cloudflare's network and gets DDoS protection, caching, and WAF for free.

**1. Install and authenticate cloudflared:**

```bash
# On your server
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared tunnel login
```

**2. Create a tunnel:**

```bash
cloudflared tunnel create divkit-preview
# Note the tunnel ID and credentials file path from the output
```

**3. Configure the tunnel** (`~/.cloudflared/config.yml`):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: preview.example.com
    service: http://localhost:8080
  - service: http_status:404
```

**4. Run everything together with Docker Compose:**

```yaml
services:
  divkit-preview:
    image: ghcr.io/<owner>/cc/divkit-preview:latest
    environment:
      - SCREENSHOT_CONCURRENCY=5
    shm_size: "512mb"
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared:/etc/cloudflared:ro
    depends_on:
      - divkit-preview
    restart: unless-stopped
```

Place your `config.yml` and credentials JSON in a `./cloudflared/` directory. Update the service URL to `http://divkit-preview:8080` since they share a Docker network.

**5. Add the DNS record:**

```bash
cloudflared tunnel route dns divkit-preview preview.example.com
```

### Cloud Run (GCP)

```bash
gcloud builds submit divkit-preview/ --tag gcr.io/PROJECT_ID/divkit-preview

gcloud run deploy divkit-preview \
  --image gcr.io/PROJECT_ID/divkit-preview \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 5 \
  --allow-unauthenticated
```

### Fly.io

```bash
cd divkit-preview
fly launch --no-deploy
# Edit fly.toml: set vm memory to 1024mb
fly deploy
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: divkit-preview
spec:
  replicas: 2
  selector:
    matchLabels:
      app: divkit-preview
  template:
    metadata:
      labels:
        app: divkit-preview
    spec:
      containers:
        - name: divkit-preview
          image: ghcr.io/<owner>/cc/divkit-preview:latest
          ports:
            - containerPort: 8080
          env:
            - name: SCREENSHOT_CONCURRENCY
              value: "5"
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1"
          volumeMounts:
            - mountPath: /dev/shm
              name: dshm
      volumes:
        - name: dshm
          emptyDir:
            medium: Memory
            sizeLimit: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: divkit-preview
spec:
  selector:
    app: divkit-preview
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

## Production notes

- **Shared memory**: Chromium needs `/dev/shm`. Use `--shm-size=512m` in Docker or mount an emptyDir in k8s.
- **Memory**: Chromium uses ~200–400MB. Allocate at least 512Mi, recommend 1Gi.
- **Concurrency**: `SCREENSHOT_CONCURRENCY` limits parallel renders. Each takes ~100–300MB. Scale based on available memory.
- **Stateless**: No database, no disk state. Scale horizontally by adding replicas.
- **Health check**: Add a `/health` endpoint if needed for your load balancer.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SCREENSHOT_CONCURRENCY` | `5` | Max concurrent screenshots |
| `PORT` | `8080` | HTTP listen port |
