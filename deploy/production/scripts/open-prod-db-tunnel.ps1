param(
  [Parameter(Mandatory = $true)]
  [string]$Host,

  [Parameter(Mandatory = $true)]
  [string]$User,

  [int]$Port = 22,

  [int]$LocalPort = 15432,

  [int]$RemotePort = 5432,

  [string]$RemoteHost = "127.0.0.1"
)

$ssh = Get-Command ssh -ErrorAction Stop

Write-Host "Opening SSH tunnel on localhost:${LocalPort} -> ${RemoteHost}:${RemotePort} via ${User}@${Host}:${Port}"
Write-Host "Keep this window open while using DBeaver, DataGrip, pgAdmin, or psql."

& $ssh.Source -N -L "${LocalPort}:${RemoteHost}:${RemotePort}" -p $Port "${User}@${Host}"
