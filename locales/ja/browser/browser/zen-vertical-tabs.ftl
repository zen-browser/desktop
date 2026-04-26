# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-toolbar-context-tabs-right = 
    .label = タブバーを右側に表示する
    .accesskey = R
zen-toolbar-context-compact-mode = 
    .label = コンパクトモード
zen-toolbar-context-compact-mode-enable = 
    .label = コンパクトモードを有効にする
    .accesskey = D
zen-toolbar-context-compact-mode-just-tabs = 
    .label = サイドバーを隠す
zen-toolbar-context-compact-mode-just-toolbar = 
    .label = ツールバーを隠す
zen-toolbar-context-compact-mode-hide-both = 
    .label = サイドバーとツールバーを隠す
    .accesskey = H
zen-toolbar-context-move-to-folder = 
    .label = フォルダに移動する…
    .accesskey = M
zen-toolbar-context-new-folder = 
    .label = 新しいフォルダ
    .accesskey = N
sidebar-zen-expand = 
    .label = サイドバーを展開する
sidebar-zen-create-new = 
    .label = 新しく作成する…
tabbrowser-unload-tab-button = 
    .tooltiptext =
        { $tabCount ->
            [one] タブをアンロードして切り替える
           *[other] { $tabCount }つタブをアンロードして最初タブに切り替える
        }
tabbrowser-reset-pin-button = 
    .tooltiptext =
        { $tabCount ->
            [one] タブをリセットして固定する
           *[other] タブをリセットして{ $tabCount }つのタブを固定する
        }
zen-tab-sublabel =
    { $tabSubtitle ->
        [zen-default-pinned] 固定された URL に戻る
        [zen-default-pinned-cmd] 固定されたタブから切り離す
       *[other] { $tabSubtitle }
    }
