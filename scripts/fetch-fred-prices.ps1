$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $projectRoot "public\data"
$outPath = Join-Path $outDir "prices.json"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Read-FredSeries {
  param(
    [Parameter(Mandatory = $true)][string]$SeriesId
  )

  $url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=$SeriesId"
  try {
    $raw = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 45
    $csv = $raw.Content | ConvertFrom-Csv
  } catch {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
      throw
    }

    Write-Warning "Invoke-WebRequest failed for $SeriesId; retrying with curl.exe."
    $curlOutput = & $curl.Source -L --fail --max-time 45 --silent --show-error $url
    if ($LASTEXITCODE -ne 0) {
      throw "curl.exe failed for $SeriesId with exit code $LASTEXITCODE."
    }

    $csv = $curlOutput | ConvertFrom-Csv
  }
  $map = @{}

  foreach ($row in $csv) {
    $date = if ($row.PSObject.Properties.Name -contains "observation_date") { $row.observation_date } else { $row.DATE }
    $valueText = $row.$SeriesId
    if ([string]::IsNullOrWhiteSpace($valueText) -or $valueText -eq ".") {
      continue
    }

    $value = 0.0
    if ([double]::TryParse($valueText, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$value)) {
      $map[$date] = $value
    }
  }

  return $map
}

$wti = Read-FredSeries -SeriesId "DCOILWTICO"
$brent = Read-FredSeries -SeriesId "DCOILBRENTEU"
$commonDates = @($wti.Keys | Where-Object { $brent.ContainsKey($_) } | Sort-Object)

if ($commonDates.Count -eq 0) {
  throw "No overlapping WTI and Brent dates were downloaded from FRED."
}

$latestDate = [datetime]::ParseExact($commonDates[-1], "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$cutoff = $latestDate.AddYears(-5)

$rows = foreach ($date in $commonDates) {
  $parsedDate = [datetime]::ParseExact($date, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  if ($parsedDate -lt $cutoff) {
    continue
  }

  [pscustomobject]@{
    date = $date
    wti = [math]::Round($wti[$date], 2)
    brent = [math]::Round($brent[$date], 2)
    spread = [math]::Round($brent[$date] - $wti[$date], 2)
  }
}

$payload = [pscustomobject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  source = "FRED DCOILWTICO and DCOILBRENTEU daily spot prices"
  latestDate = $latestDate.ToString("yyyy-MM-dd")
  rows = @($rows)
}

$payload | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path $outPath
Write-Host "Wrote $($rows.Count) aligned WTI/Brent rows to $outPath"
