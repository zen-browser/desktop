param(
    [string][Parameter(Mandatory=$true)]$SignIdentity
)

$ErrorActionPreference = "Stop"

echo "Preparing environment"
git pull --recurse-submodules
mkdir windsign-temp -ErrorAction SilentlyContinue

echo "Please UNZIP the generic and specific artifacts into windsign-temp"
echo "With the following filenames:"
echo "  - $pwd\windsign-temp\windows-x64-obj-specific"
echo "  - $pwd\windsign-temp\windows-x64-obj-generic"
Read-Host "Press Enter to continue when ready"
mkdir engine\obj-x86_64-pc-windows-msvc\ -ErrorAction SilentlyContinue
mkdir .\.github\workflows\object\ -ErrorAction SilentlyContinue

pnpm surfer ci --brand alpha

function SignAndPackage($name) {
    echo "Executing on $name"
    rmdir .\dist -Recurse -ErrorAction SilentlyContinue
    rmdir engine\obj-x86_64-pc-windows-msvc\ -Recurse -ErrorAction SilentlyContinue
    cp windsign-temp\windows-x64-obj-$name engine\obj-x86_64-pc-windows-msvc\ -Recurse
    echo "Signing $name"

    # Collect all .exe and .dll files into a list
    $files = Get-ChildItem engine\obj-x86_64-pc-windows-msvc\ -Recurse -Include *.exe
    $files += Get-ChildItem engine\obj-x86_64-pc-windows-msvc\ -Recurse -Include *.dll

    signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files
    echo "Packaging $name"
    $env:SURFER_SIGNING_MODE="sign"
    $env:MAR="$PWD\\build\\winsign\\mar.exe"
    if ($name -eq "generic") {
        $env:SURFER_COMPAT="true"
    } else {
        rm env:SURFER_COMPAT -ErrorAction SilentlyContinue
    }

    echo "Compat Mode? $env:SURFER_COMPAT"
    pnpm surfer package --verbose

    # In the release script, we do the following:
    #  tar -xvf .github/workflows/object/windows-x64-signed-generic.tar.gz -C windows-x64-signed-generic
    # We need to create a tar with the same structure and no top-level directory
    # Inside, we need:
    #  - update_manifest/*
    #  - windows.mar or windows-generic.mar
    #  - zen.installer.exe or zen.installer-generic.exe
    #  - zen.win-generic.zip or zen.win-specific.zip
    echo "Creating tar for $name"
    rm .\windsign-temp\windows-x64-signed-$name -Recurse -ErrorAction SilentlyContinue
    mkdir windsign-temp\windows-x64-signed-$name
    
    # Move the MAR, add the `-generic` suffix if needed
    if ($name -eq "generic") {
        mv .\dist\output.mar windsign-temp\windows-x64-signed-$name\windows-generic.mar
    } else {
        mv .\dist\output.mar windsign-temp\windows-x64-signed-$name\windows.mar
    }

    # Move the installer
    if ($name -eq "generic") {
        mv .\dist\zen.installer.exe windsign-temp\windows-x64-signed-$name\zen.installer-generic.exe
    } else {
        mv .\dist\zen.installer.exe windsign-temp\windows-x64-signed-$name\zen.installer.exe
    }

    # Move the zip
    mv (Get-Item .\dist\*.en-US.win64.zip) windsign-temp\windows-x64-signed-$name\zen.win-$name.zip

    # Extract the zip, sign everything inside, and repackage it
    Expand-Archive -Path windsign-temp\windows-x64-signed-$name\zen.win-$name.zip -DestinationPath windsign-temp\windows-x64-signed-$name\zen.win-$name
    rm windsign-temp\windows-x64-signed-$name\zen.win-$name.zip
    $files = Get-ChildItem windsign-temp\windows-x64-signed-$name\zen.win-$name -Recurse -Include *.exe
    $files += Get-ChildItem windsign-temp\windows-x64-signed-$name\zen.win-$name -Recurse -Include *.dll
    signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files
    Compress-Archive -Path windsign-temp\windows-x64-signed-$name\zen.win-$name -DestinationPath windsign-temp\windows-x64-signed-$name\zen.win-$name.zip
    rmdir windsign-temp\windows-x64-signed-$name\zen.win-$name -Recurse -ErrorAction SilentlyContinue

    # Move the manifest
    mv .\dist\update\. windsign-temp\windows-x64-signed-$name\update_manifest

    echo "Invoking tar for $name"
    # note: We need to sign it into a parent folder, called windows-x64-signed-$name
    rmdir .\.github\workflows\object\windows-x64-signed-$name -Recurse -ErrorAction SilentlyContinue
    mv .\windsign-temp\windows-x64-signed-$name .\.github\workflows\object\windows-x64-signed-$name -Force

    echo "Finished $name"
}

SignAndPackage specific
SignAndPackage generic

echo "All artifacts signed and packaged, ready for release!"
echo "Commiting the changes to the repository"
git add .\.github\workflows\object
git commit -m "Sign and package windows artifacts"
git push

# Cleaning up

echo "All done!"
echo "All the artifacts (Generic and Specific) are signed and packaged, get a rest now!"
Read-Host "Press Enter to continue"

echo "Cleaning up" 
rmdir windsign-temp -Recurse -ErrorAction SilentlyContinue

echo "Opening visual studio code"
code .
