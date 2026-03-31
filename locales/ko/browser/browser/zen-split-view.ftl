# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

tab-zen-split-tabs = 
    .label =
        { $tabCount ->
           [-1] 탭 쪼개기
           [1] 탭 합치기 (여러개의 탭이 선택되어 있어야 함)
          *[other] { $tabCount }개의 탭 합치기
        }
    .accesskey = S
zen-split-link = 
    .label = 링크를 새 탭으로 나누기
    .accesskey = S
zen-split-view-modifier-header = 스플릿 뷰
zen-split-view-modifier-activate-reallocation = 
    .label = 재정렬 모드 활성화
