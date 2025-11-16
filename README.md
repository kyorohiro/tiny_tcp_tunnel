```
YOUR_GCP_PROJECT_ID : tetorica 
docker-repo: tiny-tcp-tunnel-js
```

# プロジェクト選択

```
gcloud config set project tetorica
```

# Artifact Registry（または gcr.io のままでもOK）

```
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

# リポジトリ作成（まだなら）

```
gcloud artifacts repositories create tiny-tcp-tunnel-js  --repository-format=docker --location=asia-northeast1
```


# ビルド & プッシュ

```
gcloud builds submit --region=asia-northeast1 --tag asia-northeast1-docker.pkg.dev/tetorica/ tiny-tcp-tunnel-js/tiny-tcp-tunnel:latest
```
