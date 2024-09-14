#!/bin/bash

# Kawaii ASCII Art for the script
kawaii_art() {
    echo "╔════════════════════════════════════════════════╗"
    echo "║                                                ║"
    echo "║   (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧  Zen Browser Installer ✧ﾟ･:*   ║"
    echo "║                                                ║"
    echo "╚════════════════════════════════════════════════╝"
    echo
}

# Function to download a file with unlimited retries
download_until_success() {
    local url="$1"
    local output_path="$2"

    while true; do
        echo "+------------------------------------------------+"
        echo "| Downloading...                                 |"
        echo "+------------------------------------------------+"
        if curl -# -L --connect-timeout 30 --max-time 600 "$url" -o "$output_path"; then
            echo "+------------------------------------------------+"
            echo "| Download completed successfully!               |"
            echo "+------------------------------------------------+"
            break
        else
            echo "| (⌣_⌣” ) Download failed, retrying...           |"
            echo "+------------------------------------------------+"
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

    # Move AppImage to final location
    mv "${appimage_path}" ~/.local/share/AppImage/

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

choose_appimage_version() {
    echo "(◕‿◕✿) Please choose the version to install:"
    echo "+------------------------------------------------+"
    echo "| 1) Optimized - Blazing fast and compatible     |"
    echo "|    with modern devices                         |"
    echo "+------------------------------------------------+"
    echo "| 2) Generic - Slow but compatible with older    |"
    echo "|    devices                                     |"
    echo "+------------------------------------------------+"
    echo "| 3) Exit                                        |"
    echo "+------------------------------------------------+"
    read -p "Enter your choice (1/2/3): " version_choice

    case $version_choice in
        1)
            url=$(curl -s https://api.github.com/repos/zen-browser/desktop/releases/latest | grep "browser_download_url.*zen-specific.AppImage\"" | cut -d '"' -f 4)
            download_until_success "$url" ~/Downloads/ZenBrowser.AppImage
            process_appimage ~/Downloads/ZenBrowser.AppImage ZenBrowser
            ;;
        2)
            url=$(curl -s https://api.github.com/repos/zen-browser/desktop/releases/latest | grep "browser_download_url.*zen-generic.AppImage\"" | cut -d '"' -f 4)
            download_until_success "$url" ~/Downloads/ZenBrowser.AppImage
            process_appimage ~/Downloads/ZenBrowser.AppImage ZenBrowser
            ;;
        3)
            echo "(⌒‿⌒) Exiting..."
            exit 0
            ;;
        *)
            echo "(•ˋ _ ˊ•) Invalid choice. Exiting..."
            exit 1
            ;;
    esac
}

main_menu() {
    echo "(★^O^★) What would you like to do?"
    echo "+------------------------------------------------+"
    echo "| 1) Install                                     |"
    echo "+------------------------------------------------+"
    echo "| 2) Uninstall                                   |"
    echo "+------------------------------------------------+"
    echo "| 3) Exit                                        |"
    echo "+------------------------------------------------+"
    read -p "Enter your choice (1/2/3): " main_choice

    case $main_choice in
        1)
            choose_appimage_version
            ;;
        2)
            uninstall_appimage ZenBrowser
            ;;
        3)
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
