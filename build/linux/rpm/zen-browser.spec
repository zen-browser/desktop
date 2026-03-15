%global         appname     zen-browser
%global         instdir     /usr/lib/zen

Name:           zen-browser
Version:        %{_version}
Release:        1%{?dist}
Summary:        Zen Browser — experience tranquillity while browsing the web
License:        MPL-2.0
URL:            https://zen-browser.app
ExclusiveArch:  x86_64 aarch64

Requires:       gtk3
Requires:       dbus-glib
Requires:       libXt
Requires:       libXcomposite
Requires:       libXdamage
Requires:       libXrandr
Requires:       libXtst
Requires:       alsa-lib
Requires:       pulseaudio-libs
Requires:       openssl
Requires:       glib2

%description
Zen is a privacy-focused, beautifully designed web browser based on
Firefox. It offers a calm browsing experience without compromising on
speed, security, or compatibility with modern web standards.

%install
mkdir -p %{buildroot}%{instdir}
mkdir -p %{buildroot}%{instdir}/native-messaging-hosts
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/share/icons/hicolor/128x128/apps

cp -a %{_sourcedir}/zen/* %{buildroot}%{instdir}/
ln -sf %{instdir}/zen %{buildroot}/usr/bin/zen

install -m 644 %{_sourcedir}/zen-browser.desktop  %{buildroot}/usr/share/applications/zen-browser.desktop
install -m 644 %{_sourcedir}/zen.png               %{buildroot}/usr/share/icons/hicolor/128x128/apps/zen.png

%post
update-alternatives --install /usr/bin/x-www-browser x-www-browser %{instdir}/zen 200 2>/dev/null || :
# Ensure native messaging hosts directory exists so system-installed apps
# (1Password, Bitwarden, KeePassXC, etc.) can place their manifests here.
install -d -m 755 %{instdir}/native-messaging-hosts
/usr/bin/update-desktop-database -q /usr/share/applications &>/dev/null || :
/usr/bin/gtk-update-icon-cache -q -t /usr/share/icons/hicolor &>/dev/null || :

%preun
if [ $1 -eq 0 ]; then
  update-alternatives --remove x-www-browser %{instdir}/zen 2>/dev/null || :
fi

%postun
/usr/bin/update-desktop-database -q /usr/share/applications &>/dev/null || :
/usr/bin/gtk-update-icon-cache -q -t /usr/share/icons/hicolor &>/dev/null || :

%files
%{instdir}/
/usr/bin/zen
/usr/share/applications/zen-browser.desktop
/usr/share/icons/hicolor/128x128/apps/zen.png
