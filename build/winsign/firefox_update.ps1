
Remove-Item -Recurse -Force engine
Remove-Item -Recurse -Force .surfer

npm run init

$job = Start-Job -ScriptBlock {
    npm run build
}

# Wait for job to complete with timeout (in seconds)
$job | Wait-Job -Timeout 5
