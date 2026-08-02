param(
    [int]$Port = 8080
)

$root = (Get-Location).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".js"   { return "text/javascript; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".webmanifest" { return "application/manifest+json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

try {
    $listener.Start()
    Write-Host ""
    Write-Host "BMC test server is running at http://localhost:$Port" -ForegroundColor Green
    Write-Host "Serving files from: $root"
    Write-Host "Press Ctrl+C to stop."
    Write-Host ""

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                $client.Close()
                continue
            }

            do {
                $line = $reader.ReadLine()
            } while ($line -ne $null -and $line -ne "")

            $parts = $requestLine.Split(" ")
            $requestPath = [System.Uri]::UnescapeDataString($parts[1].Split("?")[0]).TrimStart("/")
            if ([string]::IsNullOrWhiteSpace($requestPath)) {
                $requestPath = "index.html"
            }

            $candidate = Join-Path $root $requestPath
            $fullPath = [System.IO.Path]::GetFullPath($candidate)

            if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $status = "403 Forbidden"
                $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
                $contentType = "text/plain; charset=utf-8"
            }
            elseif (Test-Path $fullPath -PathType Leaf) {
                $status = "200 OK"
                $body = [System.IO.File]::ReadAllBytes($fullPath)
                $contentType = Get-ContentType $fullPath
            }
            else {
                $status = "404 Not Found"
                $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                $contentType = "text/plain; charset=utf-8"
            }

            $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
