param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Destination
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputZip=[IO.Compression.ZipFile]::OpenRead($Source)
$outputStream=[IO.File]::Open($Destination,[IO.FileMode]::Create,[IO.FileAccess]::Write)
$outputZip=New-Object IO.Compression.ZipArchive($outputStream,[IO.Compression.ZipArchiveMode]::Create,$false)
$names=New-Object 'Collections.Generic.HashSet[string]'
try {
    foreach ($entry in $inputZip.Entries) {
        # aapt2 on Windows emits backslashes in asset names; Android uses '/'.
        $name=$entry.FullName.Replace('\','/')
        if (-not $names.Add($name)) { throw ('Duplicate APK entry: '+$name) }
        $compression=[IO.Compression.CompressionLevel]::Optimal
        # Android 11+ requires the resource table to remain uncompressed.
        if ($name -eq 'resources.arsc' -or $entry.CompressedLength -eq $entry.Length) {
            $compression=[IO.Compression.CompressionLevel]::NoCompression
        }
        $copy=$outputZip.CreateEntry($name,$compression)
        $read=$entry.Open()
        $write=$copy.Open()
        try { $read.CopyTo($write) } finally { $read.Dispose();$write.Dispose() }
    }
} finally {
    $inputZip.Dispose()
    $outputZip.Dispose()
    $outputStream.Dispose()
}
