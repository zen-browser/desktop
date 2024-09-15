#!/bin/bash

# Function to check if AVX2 is supported
check_avx2_support() {
    if grep -q avx2 /proc/cpuinfo; then
        return 0  # AVX2 supported
    else
        return 1  # AVX2 not supported
    fi
}

# Function to check if Zen Browser is installed
check_installation_status() {
    if [ -f ~/.local/share/AppImage/ZenBrowser.AppImage ]; then
        return 0  # Zen Browser installed
    else
        return 1  # Zen Browser not installed
    fi
}

# Function to check if zsync is installed
check_zsync_installed() {
    if command -v zsync &> /dev/null; then
        return 0  # zsync is installed
    else
        return 1  # zsync is not installed
    fi
}

# Kawaii ASCII Art for the script
kawaii_art() {
    echo "╔════════════════════════════════════════════════════╗"
    echo "║                                                    ║"
    echo "║    (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧  Zen Browser Installer ✧ﾟ･:*      ║"
    echo "║                                                    ║"
    
    if check_avx2_support; then
        echo "║    CPU: AVX2 Supported (Optimized Version)         ║"
    else
        echo "║    CPU: AVX2 Not Supported (Generic Version)       ║"
    fi

    if check_installation_status; then
        echo "║    Status: Zen Browser Installed                   ║"
    else
        echo "║    Status: Zen Browser Not Installed               ║"
    fi

    if check_zsync_installed; then
        echo "║    zsync: Installed (Needed for Updates)           ║"
    else
        echo "║    zsync: Not Installed (Needed for Updates)       ║"
    fi

    echo "╚════════════════════════════════════════════════════╝"
    echo
}

# Function to download a file with unlimited retries
download_until_success() {
    local url="$1"
    local output_path="$2"
    local mode="$3"  # New parameter to indicate the mode

    while true; do
        echo "+----------------------------------------------------+"
        case "$mode" in
            "zsync")
                echo "| Checking for Update...                             |"
                ;;
            "update")
                echo "| Updating...                                        |"
                ;;
            "install")
                echo "| Installing...                                      |"
                ;;
        esac
        echo "+----------------------------------------------------+"
        if curl -# -L --connect-timeout 30 --max-time 600 "$url" -o "$output_path"; then
            echo "+----------------------------------------------------+"
            case "$mode" in
                "zsync")
                    echo "| Checking for Update successfully!                  |"
                    ;;
                "update")
                    echo "| Update completed successfully!                     |"
                    ;;
                "install")
                    echo "| Install completed successfully!                    |"
                    ;;
            esac
            echo "+----------------------------------------------------+"
            break
        else
            echo "+----------------------------------------------------+"
            case "$mode" in
                "zsync")
                    echo "| (⌣_⌣” ) Checking for Update failed, retrying...    |"
                    ;;
                "update")
                    echo "| (⌣_⌣” ) Update failed, retrying...                 |"
                    ;;
                "install")
                    echo "| (⌣_⌣” ) Install failed, retrying...                |"
                    ;;
            esac
            echo "+----------------------------------------------------+"
            sleep 5  # Optional: wait a bit before retrying
        fi
    done
}

process_appimage() {
    local appimage_path="$1"
    local app_name="$2"

    # Make AppImage executable
    chmod +x "${appimage_path}"

    # Extract all files from AppImage
    "${appimage_path}" --appimage-extract

    # Move .desktop file (from /squashfs-root only)
    desktop_file=$(find squashfs-root -maxdepth 1 -name "*.desktop" | head -n 1)
    mv "${desktop_file}" ~/.local/share/applications/${app_name}.desktop

    # Find PNG icon (from /squashfs-root only)
    icon_file=$(find squashfs-root -maxdepth 1 -name "*.png" | head -n 1)

    # Resolve symlink if the icon is a symlink
    if [ -L "${icon_file}" ]; then
        icon_file=$(readlink -f "${icon_file}")
    fi

    # Copy the icon to the icons directory
    cp "${icon_file}" ~/.local/share/icons/${app_name}.png

    # Move AppImage to final location, only if it's not already there
    if [ "${appimage_path}" != "$HOME/.local/share/AppImage/${app_name}.AppImage" ]; then
        mv "${appimage_path}" ~/.local/share/AppImage/
    fi

    # Edit .desktop file to update paths
    desktop_file=~/.local/share/applications/${app_name}.desktop
    awk -v home="$HOME" -v app_name="$app_name" '
    BEGIN { in_action = 0 }
    /^\[Desktop Action/ { in_action = 1 }
    /^Exec=/ {
        if (in_action) {
            split($0, parts, "=")
            sub(/^[^ ]+/, "", parts[2])  # Remove the first word (original command)
            print "Exec=" home "/.local/share/AppImage/" app_name ".AppImage" parts[2]
        } else {
            print "Exec=" home "/.local/share/AppImage/" app_name ".AppImage"
        }
        next
    }
    /^Icon=/ { print "Icon=" home "/.local/share/icons/" app_name ".png"; next }
    { print }
    ' "${desktop_file}" > "${desktop_file}.tmp" && mv "${desktop_file}.tmp" "${desktop_file}"

    # Clean up extracted files
    rm -rf squashfs-root
}

uninstall_appimage() {
    local app_name="$1"

    # Remove AppImage
    rm -f ~/.local/share/AppImage/${app_name}.AppImage

    # Remove .desktop file
    rm -f ~/.local/share/applications/${app_name}.desktop

    # Remove icon
    rm -f ~/.local/share/icons/${app_name}.png

    echo "(︶︹︺) Uninstalled ${app_name}"
}

check_for_updates() {
    local zsync_url
    local zsync_file
    local appimage_url

    if check_avx2_support; then
        zsync_url="https://github.com/zen-browser/desktop/releases/latest/download/zen-specific.AppImage.zsync"
        appimage_url="https://github.com/zen-browser/desktop/releases/latest/download/zen-specific.AppImage"
    else
        zsync_url="https://github.com/zen-browser/desktop/releases/latest/download/zen-generic.AppImage.zsync"
        appimage_url="https://github.com/zen-browser/desktop/releases/latest/download/zen-generic.AppImage"
    fi

    zsync_file="${HOME}/Downloads/zen-browser.AppImage.zsync"

    if check_installation_status; then
        echo "Checking for updates..."
        if ! check_zsync_installed; then
            echo "( ͡° ʖ̯ ͡°) zsync is not installed. Please install zsync to enable update functionality."
            return 1
        fi
        download_until_success "$zsync_url" "$zsync_file" "zsync"
        update_output=$(zsync -i ~/.local/share/AppImage/ZenBrowser.AppImage -o ~/.local/share/AppImage/ZenBrowser.AppImage "$zsync_file" 2>&1)
        if echo "$update_output" | grep -q "verifying download...checksum matches OK"; then
            local version
            version="1.0.0-a.39"
            echo "(｡♥‿♥｡) Zen Browser is up-to-date! Version: $version"
        else
            echo "Updating Zen Browser..."
            download_until_success "$appimage_url" ~/.local/share/AppImage/ZenBrowser.AppImage "update"
            process_appimage ~/.local/share/AppImage/ZenBrowser.AppImage ZenBrowser
            echo "(｡♥‿♥｡) Zen Browser updated to version: 1.0.0-a.39!"
        fi
        rm -f "$zsync_file"
    else
        echo "( ͡° ʖ̯ ͡°) Zen Browser is not installed."
        main_menu
    fi
}

install_zen_browser() {
    local appimage_url

    if check_avx2_support; then
        appimage_url="https://github.com/zen-browser/desktop/releases/latest/download/zen-specific.AppImage"
    else
        appimage_url="https://github.com/zen-browser/desktop/releases/latest/download/zen-generic.AppImage"
    fi

    download_until_success "$appimage_url" ~/Downloads/ZenBrowser.AppImage "install"
    process_appimage ~/Downloads/ZenBrowser.AppImage ZenBrowser
    echo "(｡♥‿♥｡) Zen Browser installed successfully!"
}

main_menu() {
    echo "(★^O^★) What would you like to do?"
    echo "+----------------------------------------------------+"
    echo "| 1) Install                                         |"
    echo "+----------------------------------------------------+"
    echo "| 2) Uninstall                                       |"
    echo "+----------------------------------------------------+"
    if check_zsync_installed; then
        echo "| 3) Check for Updates                               |"
        echo "+----------------------------------------------------+"
    fi
    echo "| 0) Exit                                            |"
    echo "+----------------------------------------------------+"
    read -p "Enter your choice (0-3): " main_choice

    case $main_choice in
        1)
            install_zen_browser
            ;;
        2)
            uninstall_appimage ZenBrowser
            ;;
        3)
            if check_zsync_installed; then
                check_for_updates
            else
                echo "(•ˋ _ ˊ•) Invalid choice. Exiting..."
                exit 1
            fi
            ;;
        0)
            echo "(⌒‿⌒) Exiting..."
            exit 0
            ;;
        *)
            echo "(•ˋ _ ˊ•) Invalid choice. Exiting..."
            exit 1
            ;;
    esac
}

# Create necessary directories
mkdir -p ~/.local/share/applications
mkdir -p ~/.local/share/icons
mkdir -p ~/.local/share/AppImage

# Show kawaii ASCII art
kawaii_art

# Execute the main menu
main_menu
