# Face-api.js Models

Copy the models from pwa-app/public/models/ folder here, or download them using the script below.

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
