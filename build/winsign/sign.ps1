param(
    [string][Parameter(Mandatory=$true)]$SignIdentity,
    [string][Parameter(Mandatory=$true)]$RunID
)

$ErrorActionPreference = "Stop"

echo "Preparing environment"
rmdir windsign-temp -Recurse -ErrorAction SilentlyContinue
mkdir windsign-temp -ErrorAction SilentlyContinue
mkdir engine\obj-x86_64-pc-windows-msvc\ -ErrorAction SilentlyContinue

pnpm surfer ci --brand alpha

echo "Downloading from runner with ID $RunID"
gh run download $RunID --name "windows-x64-obj-specific" --dir windsign-temp\windows-x64-obj-specific
gh run download $RunID --name "windows-x64-obj-generic" --dir windsign-temp\windows-x64-obj-generic

function SignAndPackage($name) {
    echo "Executing on $name"
    rmdir engine\obj-x86_64-pc-windows-msvc\ -Recurse -ErrorAction SilentlyContinue
    mv windsign-temp\windows-x64-obj-$name engine\obj-x86_64-pc-windows-msvc\
    echo "Signing $name"
    # Collect all .exe and .dll files into a list
    $files = Get-ChildItem engine\obj-x86_64-pc-windows-msvc\ -Recurse -Include *.exe
    $files += Get-ChildItem engine\obj-x86_64-pc-windows-msvc\ -Recurse -Include *.dll
    signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha1 /v $files
    echo "Packaging $name"
    $env:SURFER_SIGNING_MODE="sign"
    $env:MAR="$PWD\build\winsign\mar.exe"
    pnpm surfer package

    echo "Taring $name"
    tar -czf windows-x64-signed-$name.tar.gz dist\

    Move-Item windows-x64-signed-$name.tar.gz .github\workflows\object\windows-x64-signed-$name.tar.gz
}

SignAndPackage specific
SignAndPackage generic

# Cleaning up

echo "All done!"
Read-Host "Press Enter to continue"

echo "Cleaning up" 
rmdir windsign-temp -Recurse -ErrorAction SilentlyContinue