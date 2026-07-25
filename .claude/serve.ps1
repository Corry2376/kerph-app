param([int]$Port = 5173)

$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $response.KeepAlive = $false

    try {
        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        $filePath = Join-Path $root ($path.TrimStart("/"))

        # HttpListenerResponse enforces true HTTP semantics for HEAD: it allows
        # Content-Length to be set to the real body size, but throws if you actually try to
        # Write() any bytes to the stream. Browsers issue HEAD probes routinely (prefetch,
        # reachability checks), so skipping the body write for them is required, not optional.
        $isHead = $request.HttpMethod -eq "HEAD"

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath)
            $contentType = $mime[$ext]
            if (-not $contentType) { $contentType = "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.LongLength
            if (-not $isHead) { $response.OutputStream.Write($bytes, 0, $bytes.Length) }
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $notFound.LongLength
            if (-not $isHead) { $response.OutputStream.Write($notFound, 0, $notFound.Length) }
        }
    } catch {
        Write-Host "Request error: $_"
    } finally {
        $response.OutputStream.Close()
        $response.Close()
    }
}
