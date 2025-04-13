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
    echo "Fetched l10n and firefox's one"
} -Verbose -ArgumentList $PWD -Debug

gh run download $GithubRunId --name windows-x64-obj-arm64 -D windsign-temp\windows-x64-obj-arm64
echo "Downloaded arm64 artifacts"
gh run download $GithubRunId --name windows-x64-obj-x86_64 -D windsign-temp\windows-x64-obj-x86_64
echo "Downloaded x86_64 artifacts"

Wait-Job -Name "DownloadGitl10n"

mkdir engine\obj-x86_64-pc-windows-msvc\ -ErrorAction SilentlyContinue

surfer -- ci --brand release

# Collect all .exe and .dll files into a list
$files = Get-ChildItem windsign-temp\windows-x64-obj-x86_64\ -Recurse -Include *.exe
$files += Get-ChildItem windsign-temp\windows-x64-obj-x86_64\ -Recurse -Include *.dll

$files = Get-ChildItem windsign-temp\windows-x64-obj-arm64\ -Recurse -Include *.exe
$files += Get-ChildItem windsign-temp\windows-x64-obj-arm64\ -Recurse -Include *.dll

signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files

function SignAndPackage($name) {
    echo "Executing on $name"
    rmdir .\dist -Recurse -ErrorAction SilentlyContinue
    rmdir engine\obj-x86_64-pc-windows-msvc\ -Recurse -ErrorAction SilentlyContinue
    cp windsign-temp\windows-x64-obj-$name engine\obj-x86_64-pc-windows-msvc\ -Recurse
    echo "Signing $name"

    echo "Packaging $name"
    $env:MAR="..\\build\\winsign\\mar.exe"
    if ($name -eq "arm64") {
        $env:SURFER_COMPAT="aarch64"
    } else {
        $env:SURFER_COMPAT="x86_64"
    }

    echo "Compat Mode? $env:SURFER_COMPAT"
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

    echo "Finished $name"
}

SignAndPackage arm64
SignAndPackage x86_64

$files = Get-ChildItem .\windsign-temp\windows-binaries -Recurse -Include *.exe
signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files

echo "All artifacts signed and packaged, ready for release!"
echo "Committing the changes to the repository"
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
