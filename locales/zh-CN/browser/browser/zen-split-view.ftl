# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

tab-zen-split-tabs = 
    .label =
        { $tabCount ->
            [-1] 取消分屏标签页
            [1] 分屏标签页（需要选择多个标签页）
           *[other] 分屏 { $tabCount } 个标签页
        }
    .accesskey = S
zen-split-link = 
    .label = 拆分链接到新标签页
    .accesskey = S
zen-split-view-modifier-header = 拆分视图
zen-split-view-modifier-activate-reallocation = 
    .label = 激活重新分配
