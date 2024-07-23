
echo Before:
if [ command -v free ]; then
    free -h
fi
if [ command -v df ]; then
    df -h
fi

echo
echo

sudo swapoff /mnt/swapfile
sudo rm /mnt/swapfile
sudo fallocate -l 10G /mnt/swapfile
sudo chmod 600 /mnt/swapfile
sudo mkswap /mnt/swapfile
sudo swapon /mnt/swapfile
sudo apt remove -y '^dotnet-.*' '^llvm-.*' '^php.*' '^mongodb-.*' '^mysql-.*' clang azure-cli google-cloud-sdk google-chrome-stable microsoft-edge firefox powershell mono-devel libgl1-mesa-dri acl aria2 autoconf automake binutils bison brotli bzip2 coreutils 
sudo apt autoremove -y
sudo apt clean
sudo rm -rf  ./git
sudo rm -rf /home/linuxbrew
sudo rm -rf /usr/share/dotnet
sudo rm -rf /usr/local/lib/android
sudo rm -rf /usr/local/graalvm
sudo rm -rf /usr/local/share/powershell
sudo rm -rf /usr/local/share/chromium
sudo rm -rf /opt/ghc
sudo rm -rf /usr/local/share/boost
sudo rm -rf "$AGENT_TOOLSDIRECTORY"
sudo rm -rf /etc/apache2
sudo rm -rf /etc/nginx
sudo rm -rf /usr/local/share/chrome_driver
sudo rm -rf /usr/local/share/edge_driver
sudo rm -rf /usr/local/share/gecko_driver
sudo rm -rf /usr/share/java
sudo rm -rf /usr/share/miniconda
sudo rm -rf /usr/local/share/vcpkg

echo
echo

echo After:
if [ command -v free ]; then
    free -h
fi
if [ command -v df ]; then
    df -h
fi
