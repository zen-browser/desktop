# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-panel-ui-current-profile-text = الملف الشخصي الحالي
unified-extensions-description = تستخدم الإضافات لجلب المزيد من الوظائف الإضافية إلى { -brand-short-name }.
tab-context-zen-reset-pinned-tab = 
    .label =
        {$isEssential ->
            [true]  إعادة تعيين علامة التبويب الأساسية 
           *[false]  إعادة تعيين التبويب المثبت
        }
    .accesskey = ر
tab-context-zen-add-essential = 
    .label = أضف إلى الأساسيات
    .accesskey = E
tab-context-zen-add-essential-badge = { $num } / { $max } مملؤة
tab-context-zen-remove-essential = 
    .label = إزالة من الأساسيات
    .accesskey = R
tab-context-zen-replace-pinned-url-with-current = 
    .label =
        {$isEssential ->
            [true] استبدل الرابط الأساسي بـ
           *[false] استبدل الرابط المثبت بـ
         الحالي
        }
    .accesskey = C
tab-context-zen-edit-title = 
    .label = تغيير الاسم...
tab-context-zen-edit-icon = 
    .label = تغيير الأيقونة...
zen-themes-corrupted = ملف التعديل { -brand-short-name } الخاص بك تالف. تم إعادة تعيينه إلى السمة الافتراضية.
zen-shortcuts-corrupted = ملف الاختصارات { -brand-short-name } الخاص بك تالف. تم إعادة تعيينه إلى الاختصارات الافتراضية.
# note: Do not translate the "<br/>" tags in the following string
zen-new-urlbar-notification =
    تم تمكين شريط URL الجديد، بإزالة الحاجة إلى صفحات علامة تبويب جديدة.<br/><br/>
    حاول فتح علامة تبويب جديدة لمشاهدة شريط URL الجديد قيد العمل!
zen-disable = تعطيل
pictureinpicture-minimize-btn = 
    .aria-label = تقليص
    .tooltip = تقليص
zen-panel-ui-gradient-generator-custom-color = لون مخصص
zen-copy-current-url-confirmation = تم نسخ الرابط الحالي!
zen-copy-current-url-as-markdown-confirmation = نسخ الرابط الحالي كـ Markdown!
zen-general-cancel-label = 
    .label = إلغاء
zen-general-confirm = 
    .label = تأكيد
zen-pinned-tab-replaced = Pinned tab URL has been replaced with the current URL.
zen-tabs-renamed = تم تغيير اسم التبويب بنجاح!
zen-background-tab-opened-toast = تم فتح علامة تبويب خلفية جديدة!
zen-workspace-renamed-toast = تم تغيير اسم مساحة العمل بنجاح!
zen-toggle-compact-mode-button = 
    .label = الوضع المدمج
    .tooltiptext = تبديل الوضع المدمج

# note: Do not translate the "<br/>" tags in the following string

zen-learn-more-text = إلى المزيد تعرف
zen-close-label = أغلق
zen-singletoolbar-urlbar-placeholder-with-name = 
    .placeholder = ابحث...
zen-icons-picker-emoji = 
    .label = ايموجي
zen-icons-picker-svg = 
    .label = الأيقونات
urlbar-search-mode-zen_actions = الإجراءات
zen-site-data-settings = الاعدادات
zen-generic-manage = إدارة
zen-generic-more = المزيد
zen-generic-next = التالي
zen-essentials-promo-label = أضف إلى الأساسيات
zen-essentials-promo-sublabel = إبقاء علامات التبويب المفضلة لديك فقط بنقرة
# These labels will be used for the site data panel settings
zen-site-data-setting-allow = مسموح
zen-site-data-setting-block = محظور
zen-site-data-protections-enabled = مفعّل
zen-site-data-protections-disabled = معطَّل
zen-site-data-setting-cross-site = ملف تعريف الارتباط عبر المواقع
zen-site-data-security-info-extension = 
    .label = ملحق
zen-site-data-security-info-secure = 
    .label = آمن
zen-site-data-security-info-not-secure = 
    .label = غير آمن
zen-site-data-manage-addons = 
    .label = إدارة الملحقات
zen-site-data-get-addons = 
    .label = إضافة ملحق
zen-site-data-site-settings = 
    .label = جميع إعدادات الموقع
zen-site-data-header-share = 
    .tooltiptext = شارك هذه الصفحة
zen-site-data-header-reader-mode = 
    .tooltiptext = أدخل وضع القارئ
zen-site-data-header-screenshot = 
    .tooltiptext = التقاط الشاشة
zen-site-data-header-bookmark = 
    .tooltiptext = ضع إشارة مرجعية على هذه الصفحة
zen-urlbar-copy-url-button = 
    .tooltiptext = نسخ الرابط
zen-site-data-setting-site-protection = حماية التتبع

# Section: Feature callouts

zen-site-data-panel-feature-callout-title = منزل جديد للإضافات والأذونات والمزيد
zen-site-data-panel-feature-callout-subtitle = انقر على أيقونة لإدارة إعدادات الموقع، وعرض معلومات الأمان، والوصول إلى الملحقات، وتنفيذ الإجراءات الشائعة.
zen-open-link-in-glance = 
    .label = فتح الرابط بلمحة
    .accesskey = G
zen-sidebar-notification-updated-heading = اكتمل التحديث!

# See ZenSidebarNotification.mjs to see how these would be used

zen-sidebar-notification-updated-label = ما الجديد في { -brand-short-name }
zen-sidebar-notification-updated-tooltip = 
    .title = عرض ملاحظات الإصدار
zen-sidebar-notification-restart-safe-mode-label = شيء معطل؟
zen-sidebar-notification-restart-safe-mode-tooltip = 
    .title = إعادة التشغيل في الوضع الآمن
zen-window-sync-migration-dialog-title = حافظ على تزامن نوافذك
zen-window-sync-migration-dialog-message = يقوم Zen الآن بمزامنة النوافذ على نفس الجهاز، لذا فإن التغييرات في نافذة واحدة تنعكس في النوافذ الأخرى على الفور.
zen-window-sync-migration-dialog-learn-more = تعرف على المزيد
zen-window-sync-migration-dialog-accept = فهمت
zen-appmenu-new-blank-window = 
    .label = نافذة فارغة جديدة
