# Native PowerShell HTTP Server for Local Testing
$port = 8000
$localPath = Get-Location
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "--- LIQUID LOCAL SERVER ---"
Write-Host "Running at http://localhost:$port/"
Write-Host "Serving: $localPath"
Write-Host "Press Ctrl+C to stop (or terminate the command)"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        
        # --- API MOCK INTERCEPTOR (For Local Testing) ---
        if ($urlPath -eq "/api/extract") {
            Write-Host "--- MOCKING AI EXTRACTION ---"
            $mockJson = '{"candidates":[{"content":{"parts":[{"text":"{\"name\":\"Wilson Chen\",\"company\":\"Nexus Tech\",\"designation\":\"VP Sales\",\"phone\":\"+971 50 123 4567\",\"email\":\"wilson@nexustech.io\",\"website\":\"nexustech.io\",\"address\":\"Dubai Silicon Oasis\"}"}]}}]}'
            $content = [System.Text.Encoding]::UTF8.GetBytes($mockJson)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
            $response.Close()
            continue
        }

        $filePath = Join-Path $localPath $urlPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            # Simple content type mapping
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html" }
                ".css"  { "text/css" }
                ".js"   { "application/javascript" }
                ".png"  { "image/png" }
                ".json" { "application/json" }
                default { "application/octet-stream" }
            }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            Write-Host "404 Not Found: $urlPath"
        }
        $response.Close()
    } catch {
        Write-Host "Server Error: $_"
    }
}
