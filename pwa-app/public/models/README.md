# Face-api.js Models

Download the following models from:
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Required models:
1. ssd_mobilenetv1_model-weights_manifest.json
2. ssd_mobilenetv1_model-shard1
3. ssd_mobilenetv1_model-shard2
4. face_landmark_68_model-weights_manifest.json
5. face_landmark_68_model-shard1
6. face_recognition_model-weights_manifest.json
7. face_recognition_model-shard1
8. face_recognition_model-shard2

Place all downloaded files in this folder (public/models/).

## Download Script (PowerShell)

```powershell
$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$models = @(
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

foreach ($model in $models) {
    Invoke-WebRequest -Uri "$baseUrl/$model" -OutFile $model
    Write-Host "Downloaded: $model"
}
```

## Download Script (Bash)

```bash
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

curl -O "$BASE_URL/ssd_mobilenetv1_model-weights_manifest.json"
curl -O "$BASE_URL/ssd_mobilenetv1_model-shard1"
curl -O "$BASE_URL/ssd_mobilenetv1_model-shard2"
curl -O "$BASE_URL/face_landmark_68_model-weights_manifest.json"
curl -O "$BASE_URL/face_landmark_68_model-shard1"
curl -O "$BASE_URL/face_recognition_model-weights_manifest.json"
curl -O "$BASE_URL/face_recognition_model-shard1"
curl -O "$BASE_URL/face_recognition_model-shard2"
```
