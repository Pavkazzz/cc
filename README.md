# DivKit Preview Service

Renders [DivKit](https://divkit.tech/) layouts to PNG screenshots via an HTTP API.

## Quick start

```bash
docker build -t divkit-preview divkit-preview/
docker run -p 8080:8080 divkit-preview
```

Then take a screenshot:

```bash
curl -X POST http://localhost:8080/preview.png \
  -H "Content-Type: application/json" \
  -d @layout.json \
  -o preview.png
```

## Deploy

### Docker (any host)

```bash
docker build -t divkit-preview divkit-preview/
docker run -d \
  --name divkit-preview \
  -p 8080:8080 \
  -e SCREENSHOT_CONCURRENCY=5 \
  --restart unless-stopped \
  divkit-preview
```

### Docker Compose

```yaml
services:
  divkit-preview:
    build: ./divkit-preview
    ports:
      - "8080:8080"
    environment:
      - SCREENSHOT_CONCURRENCY=5
      - PORT=8080
    restart: unless-stopped
    # Chromium needs shared memory
    shm_size: "512mb"
```

```bash
docker compose up -d
```

### Cloud Run (GCP)

```bash
# Build and push
gcloud builds submit divkit-preview/ --tag gcr.io/PROJECT_ID/divkit-preview

# Deploy (min 1 CPU for Chromium, 1Gi memory)
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
# Edit fly.toml: set vm memory to 1024mb, add shm_size
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
          image: divkit-preview:latest
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
          # Chromium needs /dev/shm
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

## Important notes for production

- **Shared memory**: Chromium needs `/dev/shm`. Use `shm_size: 512mb` in Docker or mount an emptyDir in k8s.
- **Memory**: Chromium uses ~200–400MB. Allocate at least 512Mi, recommend 1Gi.
- **Concurrency**: `SCREENSHOT_CONCURRENCY` limits parallel renders. Each takes ~100–300MB. Scale based on available memory.
- **Stateless**: No database, no disk state. Scale horizontally by adding replicas.
- **Health check**: `GET /` returns 404 (no handler) — add a `/health` endpoint if needed for your load balancer.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SCREENSHOT_CONCURRENCY` | `5` | Max concurrent screenshots |
| `PORT` | `8080` | HTTP listen port |
