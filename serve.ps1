# Servidor HTTP estatico simples para testar o portal localmente.
param(
  [string]$Root = "C:\Users\Totali\Desktop\Onboarding",
  [int]$Port = 8099
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Servindo $Root em http://localhost:$Port/"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".webmanifest"="application/manifest+json; charset=utf-8"; ".png"="image/png";
  ".jpg"="image/jpeg"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".txt"="text/plain; charset=utf-8"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $path = Join-Path $Root $rel
    if (Test-Path $path -PathType Container) { $path = Join-Path $path "index.html" }

    if (Test-Path $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = $ct
      # Sem cache no ambiente de teste: senao o navegador continua
      # servindo o JS antigo e voce depura um codigo que nao existe mais.
      $ctx.Response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
      $ctx.Response.StatusCode = 200
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes("404")
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch {
    Write-Host "erro: $_"
  }
}
