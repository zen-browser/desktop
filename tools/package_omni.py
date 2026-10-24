#!/usr/bin/env python3
import sys
import os
import shutil

sys.path.insert(0, os.path.abspath('engine/python/mozbuild'))
from mozpack.mozjar import JarReader, JarWriter

def main():
    root_dir = os.path.abspath('.')
    omni_path = os.path.join(root_dir, 'Zen.app/Contents/Resources/browser/omni.ja')
    omni_bak = os.path.join(root_dir, 'Zen.app/Contents/Resources/browser/omni.ja.bak')
    omni_tmp = os.path.join(root_dir, 'Zen.app/Contents/Resources/browser/omni.ja.tmp')

    if not os.path.exists(omni_bak):
        print(f"Creating backup at {omni_bak}...")
        shutil.copy2(omni_path, omni_bak)

    print("Reading base omni.ja...")
    reader = JarReader(omni_bak)

    # Get preloaded order
    preloaded = []
    if reader.is_optimized:
        for item in reader:
            preloaded.append(item.filename)
            if item.filename == reader.last_preloaded:
                break
        print(f"Captured {len(preloaded)} preloaded members.")

    # Re-open reader to read all items
    reader = JarReader(omni_bak)

    overrides = {}

    def read_local(rel_path):
        with open(os.path.join(root_dir, rel_path), 'rb') as f:
            return f.read()

    # 1. Custom modules
    overrides['modules/zen/ZenArcImporter.sys.mjs'] = read_local('src/zen/spaces/ZenArcImporter.sys.mjs')
    overrides['modules/zen/ArcProfileMigrator.sys.mjs'] = read_local('src/zen/spaces/ArcProfileMigrator.sys.mjs')
    overrides['modules/ChromeProfileMigrator.sys.mjs'] = read_local('engine/browser/components/migration/ChromeProfileMigrator.sys.mjs')
    overrides['modules/MigrationUtils.sys.mjs'] = read_local('engine/browser/components/migration/MigrationUtils.sys.mjs')
    overrides['modules/ChromeMigrationUtils.sys.mjs'] = read_local('engine/browser/components/migration/ChromeMigrationUtils.sys.mjs')
    overrides['actors/MigrationWizardParent.sys.mjs'] = read_local('engine/browser/components/migration/MigrationWizardParent.sys.mjs')

    # 2. Startup & Welcome
    overrides['chrome/browser/content/browser/ZenStartup.mjs'] = read_local('src/zen/common/modules/ZenStartup.mjs')
    overrides['chrome/browser/content/browser/zen-components/ZenWelcome.mjs'] = read_local('src/zen/welcome/ZenWelcome.mjs')
    overrides['chrome/browser/content/browser/zen-components/ZenCommonUtils.mjs'] = read_local('src/zen/common/modules/ZenCommonUtils.mjs')

    # 3. Preferences JS and FTL
    overrides['chrome/browser/content/browser/preferences/zen-settings.js'] = read_local('src/browser/components/preferences/zen-settings.js')
    overrides['localization/en-US/browser/preferences/zen-preferences.ftl'] = read_local('locales/en-US/browser/browser/preferences/zen-preferences.ftl')
    overrides['localization/en-US/browser/migrationWizard.ftl'] = read_local('engine/browser/locales/en-US/browser/migrationWizard.ftl')
    overrides['modules/ZenUBGlobalActions.sys.mjs'] = read_local('src/zen/urlbar/ZenUBGlobalActions.sys.mjs')
    overrides['localization/en-US/browser/zen-command-palette.ftl'] = read_local('locales/en-US/browser/browser/zen-command-palette.ftl')
    overrides['localization/fr/browser/zen-command-palette.ftl'] = read_local('locales/fr/browser/browser/zen-command-palette.ftl')

    # 4. Images
    arc_png = read_local('src/zen/images/favicons/arc.png')
    arc_svg = read_local('src/zen/images/favicons/arc.svg')
    dia_png = read_local('src/zen/images/favicons/dia.png')
    dia_svg = read_local('src/zen/images/favicons/dia.svg')

    overrides['chrome/browser/content/browser/zen-images/favicons/arc.png'] = arc_png
    overrides['chrome/browser/content/browser/zen-images/favicons/arc.svg'] = arc_svg
    overrides['chrome/browser/content/browser/migration/brands/arc.png'] = arc_png
    overrides['chrome/browser/content/browser/migration/brands/arc.svg'] = arc_svg

    overrides['chrome/browser/content/browser/zen-images/favicons/dia.png'] = dia_png
    overrides['chrome/browser/content/browser/zen-images/favicons/dia.svg'] = dia_svg
    overrides['chrome/browser/content/browser/migration/brands/dia.png'] = dia_png
    overrides['chrome/browser/content/browser/migration/brands/dia.svg'] = dia_svg

    writer = JarWriter(omni_tmp, compress=True)

    button_markup = '''\
      <vbox class="zen-settings-subcard" style="margin-top: 10px;">
            <hbox align="center" style="display: flex; justify-content: space-between; align-items: center;">
                  <vbox>
                        <label><html:h3 data-l10n-id="zen-settings-import-browser-data-header"/></label>
                        <description class="description-deemphasized" data-l10n-id="zen-settings-import-browser-data-description"/>
                  </vbox>
                  <button id="zenWorkspacesImportBrowserDataButton"
                          class="accessory-button"
                          data-l10n-id="zen-settings-import-browser-data-button"/>
            </hbox>
      </vbox>'''

    for item in reader:
        filename = item.filename
        if filename in overrides:
            print(f"Overriding {filename}...")
            writer.add(filename, overrides.pop(filename))
        elif filename == 'defaults/preferences/firefox.js':
            print("Patching defaults/preferences/firefox.js...")
            content = item.read().decode('utf-8')
            arc_pref = 'pref("browser.migrate.arc.enabled", true);'
            dia_pref = 'pref("browser.migrate.dia.enabled", true);'
            if arc_pref not in content:
                needle = 'pref("browser.migrate.brave.enabled", true);'
                if needle in content:
                    content = content.replace(needle, f'{arc_pref}\n{dia_pref}\n{needle}', 1)
                else:
                    content += f'\n{arc_pref}\n{dia_pref}\n'
            elif dia_pref not in content:
                needle = 'pref("browser.migrate.brave.enabled", true);'
                if needle in content:
                    content = content.replace(needle, f'{dia_pref}\n{needle}', 1)
                else:
                    content += f'\n{dia_pref}\n'
            writer.add(filename, content.encode('utf-8'))
        elif filename == 'chrome/browser/content/browser/preferences/preferences.xhtml':
            print("Patching preferences.xhtml...")
            content = item.read().decode('utf-8')
            needle = 'preference="zen.tabs.select-recently-used-on-close"/>\n</groupbox>'
            replacement = f'preference="zen.tabs.select-recently-used-on-close"/>\n\n{button_markup}\n</groupbox>'
            if needle in content:
                content = content.replace(needle, replacement, 1)
            else:
                print("WARNING: needle not found in preferences.xhtml")
            writer.add(filename, content.encode('utf-8'))
        elif filename.endswith('browser/migrationWizard.ftl'):
            content = item.read().decode('utf-8')
            arc_key = "migration-wizard-migrator-display-name-arc"
            dia_key = "migration-wizard-migrator-display-name-dia"
            if arc_key not in content:
                needle = "migration-wizard-migrator-display-name-brave"
                if needle in content:
                    content = content.replace(needle, f"{arc_key} = Arc\n{dia_key} = Dia\n{needle}", 1)
                else:
                    content += f"\n{arc_key} = Arc\n{dia_key} = Dia\n"
            elif dia_key not in content:
                needle = "migration-wizard-migrator-display-name-brave"
                if needle in content:
                    content = content.replace(needle, f"{dia_key} = Dia\n{needle}", 1)
                else:
                    content += f"\n{dia_key} = Dia\n"
            writer.add(filename, content.encode('utf-8'))
        elif filename.endswith('browser/preferences/zen-preferences.ftl'):
            content = item.read().decode('utf-8')
            arc_key = "zen-settings-import-browser-data-button"
            if arc_key not in content:
                content += """
zen-settings-import-browser-data-header = Import Data
zen-settings-import-browser-data-description = Import your spaces, bookmarks, tabs, and history from other browsers.
zen-settings-import-browser-data-button = Import Browser Data
zen-migration-browser-arc = Arc
"""
            writer.add(filename, content.encode('utf-8'))
        else:
            # Preserve existing entry without uncompressing
            writer.add(filename, item)

    # Add any remaining new files
    for filename, data in overrides.items():
        print(f"Adding new file {filename}...")
        writer.add(filename, data)

    if preloaded:
        print(f"Applying preload of {len(preloaded)} files...")
        writer.preload(preloaded)

    print("Finishing archive...")
    writer.finish()

    print(f"Replacing {omni_path}...")
    shutil.move(omni_tmp, omni_path)
    
    app_target = '/Applications/Zen.app/Contents/Resources/browser/omni.ja'
    if os.path.exists('/Applications/Zen.app') and os.access(app_target, os.W_OK):
        print(f"Also syncing to {app_target}...")
        shutil.copy2(omni_path, app_target)

    # Clean macOS detritus and re-sign
    print("Signing Zen.app...")
    os.system('find Zen.app -name "._*" -delete 2>/dev/null')
    os.system('xattr -cr Zen.app 2>/dev/null')
    os.system('codesign --force --deep -s - Zen.app 2>/dev/null')

    if os.path.exists('/Applications/Zen.app'):
        os.system('find /Applications/Zen.app -name "._*" -delete 2>/dev/null')
        os.system('xattr -cr /Applications/Zen.app 2>/dev/null')
        os.system('codesign --force --deep -s - /Applications/Zen.app 2>/dev/null')

    print("Repack and codesign complete successfully!")

if __name__ == '__main__':
    main()
