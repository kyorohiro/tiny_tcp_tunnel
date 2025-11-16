# Tiny TCP Tunnel (WebSocket Reverse Proxy)

A **minimal reverse tunnel server** written in TypeScript for **Cloud Run**.  
It forwards incoming HTTP requests to a connected client over WebSocket, allowing
you to expose a local service securely through Cloud Run — similar to `ngrok`, but entirely self-hosted.


## How to use (local)

```
$ npx tsx src/hello.ts
$ npx tsx src/server.ts
$ SERVER=ws://localhost:8080 npx tsx src/client.ts
```

## How to use (stage)

```
SERVER=wss://tiny-tcp-tunnel-749011550684.asia-northeast1.run.app TOKEN=74A2A5DD-10A2-4144-ADDE-xxxxxx npx tsx src/client.ts
```


## Setup

### 1. Environment

- Node.js ≥ 18
- TypeScript ≥ 5
- Cloud Run enabled on Google Cloud

```
YOUR_GCP_PROJECT_ID : tetorica 
docker-repo: docker-repo
image-id: tiny-tcp-tunnel-js
```

#### プロジェクト選択

```
gcloud config set project tetorica
```

#### Artifact Registry（または gcr.io のままでもOK）

```
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

#### create repogitoy 

```
gcloud artifacts repositories create docker-repo --repository-format=docker --location=asia-northeast1
```


#### build & push

```
gcloud builds submit --region=asia-northeast1 --tag asia-northeast1-docker.pkg.dev/tetorica/docker-repo/tiny-tcp-tunnel-js:latest
```

#### deploy

```
gcloud run deploy tiny-tcp-tunnel \
  --image=asia-northeast1-docker.pkg.dev/tetorica/docker-repo/tiny-tcp-tunnel-js:latest \
  --platform=managed \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars=TOKEN=supersecret

```

