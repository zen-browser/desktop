param(
    [string][Parameter(Mandatory=$true)]$SignIdentity,
    [string][Parameter(Mandatory=$true)]$GithubRunId
)

$ErrorActionPreference = "Stop"

echo "Preparing environment"
git pull --recurse
mkdir windsign-temp -ErrorAction SilentlyContinue

# Download in parallel

#show output too
#Start-Job -Name "DownloadGitObjectsRepo" -ScriptBlock {
#    param($PWD)
#    echo "Downloading git objects repo to $PWD\windsign-temp\windows-binaries"
#    git clone https://github.com/zen-browser/windows-binaries.git $PWD\windsign-temp\windows-binaries
#    echo "Downloaded git objects repo to"
#} -Verbose -ArgumentList $PWD -Debug

Start-Job -Name "DownloadGitl10n" -ScriptBlock {
    param($PWD)
    cd $PWD
    $env:ZEN_L10N_CURR_DIR=[regex]::replace($PWD, "^([A-Z]):", { "/" + $args.value.Substring(0, 1).toLower() }) -replace "\\", "/"
    C:\mozilla-build\start-shell.bat $PWD\scripts\download-language-packs.sh
    echo "Fetched l10n and Firefox's one"
} -Verbose -ArgumentList $PWD -Debug

Start-Job -Name "SurferInit" -ScriptBlock {
    param($PWD)
    cd $PWD
    npm run import -- --verbose
    npm run surfer -- ci --brand release
} -Verbose -ArgumentList $PWD -Debug

echo "Downloading artifacts info"
$artifactsInfo=gh api repos/zen-browser/desktop/actions/runs/$GithubRunId/artifacts
$token = gh auth token

function New-TemporaryDirectory {
    $tmp = [System.IO.Path]::GetTempPath() # Not $env:TEMP, see https://stackoverflow.com/a/946017
    $name = (New-Guid).ToString("N")
    New-Item -ItemType Directory -Path (Join-Path $tmp $name)
}

function DownloadFile($url, $targetFile) {
   $uri = New-Object "System.Uri" "$url"
   $request = [System.Net.HttpWebRequest]::Create($uri)
   $request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
   $request.Headers.Add("Authorization", "Bearer $token")
   $response = $request.GetResponse()
   $totalLength = [System.Math]::Floor($response.get_ContentLength()/1024)
   $responseStream = $response.GetResponseStream()
   $targetStream = New-Object -TypeName System.IO.FileStream -ArgumentList $targetFile, Create
   $buffer = new-object byte[] 10KB
   $count = $responseStream.Read($buffer,0,$buffer.length)
   $downloadedBytes = $count

    while ($count -gt 0) {
        $targetStream.Write($buffer, 0, $count)
        $count = $responseStream.Read($buffer,0,$buffer.length)
        $downloadedBytes = $downloadedBytes + $count
        Write-Progress -activity "Downloading file '$($url.split('/') | Select -Last 1)'" -status "Downloaded ($([System.Math]::Floor($downloadedBytes/1024))K of $($totalLength)K): " -PercentComplete ((([System.Math]::Floor($downloadedBytes/1024)) / $totalLength)  * 100)
    }

   Write-Progress -activity "Finished downloading file '$($url.split('/') | Select -Last 1)'"

   $targetStream.Flush()
   $targetStream.Close()
   $targetStream.Dispose()
   $responseStream.Dispose()
}

function DownloadArtifacts($name) {
    echo "Downloading artifacts for $name"
    $artifactUrl=$($artifactsInfo | jq -r --arg NAME "windows-x64-obj-$name" '.artifacts[] | select(.name == $NAME) | .archive_download_url')
    echo "Artifact URL: $artifactUrl"

    # download the artifact
    $outputPath="$PWD\windsign-temp\windows-x64-obj-$name"
    $tempDir = New-TemporaryDirectory
    $tempFile = Join-Path $tempDir "artifact-$($name).zip"

    echo "Downloading artifact to $tempFile"
    DownloadFile $artifactUrl $tempFile

    Start-Job -Name "UnzipArtifact$name" -ScriptBlock {
        param($tempFile, $outputPath)
        echo "Unzipping artifact to $outputPath"
        Expand-Archive -Path $tempFile -DestinationPath $outputPath -Force
        echo "Unzipped artifact to $outputPath"
    } -ArgumentList $tempFile, $outputPath -Verbose -Debug
}

DownloadArtifacts arm64
DownloadArtifacts x86_64

# Wait for the jobs to finish
Wait-Job -Name "UnzipArtifactarm64"
Wait-Job -Name "UnzipArtifactx86_64"

mkdir engine\obj-x86_64-pc-windows-msvc\ -ErrorAction SilentlyContinue

# Collect all .exe and .dll files into a list
$files = Get-ChildItem windsign-temp\windows-x64-obj-x86_64\ -Recurse -Include *.exe
$files += Get-ChildItem windsign-temp\windows-x64-obj-x86_64\ -Recurse -Include *.dll

$files += Get-ChildItem windsign-temp\windows-x64-obj-arm64\ -Recurse -Include *.exe
$files += Get-ChildItem windsign-temp\windows-x64-obj-arm64\ -Recurse -Include *.dll

signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files

$env:ZEN_RELEASE="true"
$env:SURFER_SIGNING_MODE="true"
Wait-Job -Name "SurferInit"
Wait-Job -Name "DownloadGitl10n"

function SignAndPackage($name) {
    echo "Executing on $name"
    rmdir .\dist -Recurse -ErrorAction SilentlyContinue
    rmdir engine\obj-$name-pc-windows-msvc\ -Recurse -ErrorAction SilentlyContinue
    $objName=$name
    # instead of arm, use aarch64
    if ($name -eq "arm64") {
        $objName="aarch64"
    }

    echo "Removing old obj dir"
    rmdir engine\obj-$objName-pc-windows-msvc\ -Recurse -ErrorAction SilentlyContinue

    echo "Creating new obj dir"
    cp windsign-temp\windows-x64-obj-$name engine\obj-$objName-pc-windows-msvc\ -Recurse

    echo "Copying setup.exe into obj dir"
    $env:ZEN_SETUP_EXE_PATH="$PWD\windsign-temp\windows-x64-obj-$name\browser\installer\windows\instgen\setup.exe"

    if ($name -eq "arm64") {
        $env:WIN32_REDIST_DIR="$PWD\win-cross\vs2022\VC\Redist\MSVC\14.38.33135\arm64\Microsoft.VC143.CRT"
    } else {
        $env:WIN32_REDIST_DIR="$PWD\win-cross\vs2022\VC\Redist\MSVC\14.38.33135\x64\Microsoft.VC143.CRT"
    }

    $env:MAR="..\\build\\winsign\\mar.exe"
    if ($name -eq "arm64") {
        $env:SURFER_COMPAT="aarch64"
    } else {
        $env:SURFER_COMPAT="x86_64"
    }
    echo "Compat Mode? $env:SURFER_COMPAT"

    # Configure each time since we are cloning from a linux environment into
    # a windows environment, and the build system is not smart enough to detect that
    # we are on a different platform.
    cd .\engine
    echo "Configuring for $name"
    .\mach configure
    cd ..

    echo "Packaging $name"
    npm run package -- --verbose

    # In the release script, we do the following:
    #  tar -xvf .github/workflows/object/windows-x64-signed-x86_64.tar.gz -C windows-x64-signed-x86_64
    # We need to create a tar with the same structure and no top-level directory
    # Inside, we need:
    #  - update_manifest/*
    #  - windows.mar
    #  - zen.installer.exe
    echo "Creating tar for $name"
    rm .\windsign-temp\windows-x64-signed-$name -Recurse -ErrorAction SilentlyContinue
    mkdir windsign-temp\windows-x64-signed-$name

    # Move the MAR, add the `-arm64` suffix if needed
    echo "Moving MAR for $name"
    if ($name -eq "arm64") {
        mv .\dist\output.mar windsign-temp\windows-x64-signed-$name\windows-$name.mar
    } else {
        mv .\dist\output.mar windsign-temp\windows-x64-signed-$name\windows.mar
    }

    # Move the installer
    echo "Moving installer for $name"
    if ($name -eq "arm64") {
        mv .\dist\zen.installer.exe windsign-temp\windows-x64-signed-$name\zen.installer-$name.exe
    } else {
        mv .\dist\zen.installer.exe windsign-temp\windows-x64-signed-$name\zen.installer.exe
    }

    # Move the manifest
    mv .\dist\update\. windsign-temp\windows-x64-signed-$name\update_manifest

    # note: We need to sign it into a parent folder, called windows-x64-signed-$name
    rmdir .\windsign-temp\windows-binaries\windows-x64-signed-$name -Recurse -ErrorAction SilentlyContinue
    mv windsign-temp\windows-x64-signed-$name .\windsign-temp\windows-binaries -Force
    rmdir engine\obj-$objName-pc-windows-msvc\ -Recurse -ErrorAction SilentlyContinue

    echo "Finished $name"
}

SignAndPackage arm64
SignAndPackage x86_64

$files = Get-ChildItem .\windsign-temp\windows-binaries -Recurse -Include *.exe
signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files

echo "All artifacts signed and packaged, ready for release!"
echo "Commiting the changes to the repository"
cd windsign-temp\windows-binaries
git add .
git commit -m "Sign and package windows artifacts"
git push
cd ..\..

# Cleaning up

echo "All done!"
echo "All the artifacts (x86_64 and arm46) are signed and packaged, get a rest now!"
Read-Host "Press Enter to continue"

echo "Cleaning up"
rmdir windsign-temp\windows-x64-obj-x86_64 -Recurse -ErrorAction SilentlyContinue
rmdir windsign-temp\windows-x64-obj-arm64 -Recurse -ErrorAction SilentlyContinue

echo "Opening visual studio code"
code .
