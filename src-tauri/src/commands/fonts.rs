// src/commands/fonts.rs
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct FontInfo {
    pub family: String,
    pub style: String,
}

#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<FontInfo>, String> {
    #[cfg(target_os = "windows")]
    return get_fonts_windows();

    #[cfg(target_os = "macos")]
    return get_fonts_macos();

    #[cfg(target_os = "linux")]
    return get_fonts_linux();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    Err("Unsupported platform".into())
}

// ==================== Windows ====================
#[cfg(target_os = "windows")]
fn get_fonts_windows() -> Result<Vec<FontInfo>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::Foundation::LPARAM;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, EnumFontFamiliesExW, DEFAULT_CHARSET, FONTENUMPROCW,
        LOGFONTW, TEXTMETRICW,
    };

    unsafe extern "system" fn enum_callback(
        logfont: *const LOGFONTW,
        _textmetric: *const TEXTMETRICW,
        _font_type: u32,
        lparam: LPARAM,
    ) -> i32 {
        if logfont.is_null() {
            return 1;
        }
        let lf = &*logfont;
        // 跳过垂直字体（以 @ 开头）和符号字体
        if lf.lfFaceName[0] == '@' as u16
            || lf.lfCharSet == windows::Win32::Graphics::Gdi::FONT_CHARSET(2)
        {
            return 1;
        }
        let name = OsString::from_wide(
            &lf.lfFaceName[..lf.lfFaceName.iter().position(|&c| c == 0).unwrap_or(32)],
        )
        .to_string_lossy()
        .to_string();

        // ✅ 关键修复：LPARAM 是元组结构体，必须通过 .0 获取内部 isize
        let list = &mut *(lparam.0 as *mut Vec<FontInfo>);
        // 去重：同一 family 只保留第一个
        if !list.iter().any(|f| f.family == name) {
            list.push(FontInfo {
                family: name,
                style: String::new(),
            });
        }
        1 // 继续枚举
    }

    unsafe {
        let hdc = CreateCompatibleDC(None);
        if hdc.is_invalid() {
            return Err("Failed to create HDC".into());
        }

        let mut fonts: Vec<FontInfo> = Vec::with_capacity(256);
        let mut logfont = LOGFONTW::default();
        logfont.lfCharSet = DEFAULT_CHARSET;

        let callback: FONTENUMPROCW = Some(enum_callback);
        let result = EnumFontFamiliesExW(
            hdc,
            &logfont,
            callback,
            LPARAM(&mut fonts as *mut Vec<FontInfo> as isize),
            0,
        );

        let _ = DeleteDC(hdc);

        if result == 0 {
            return Err("EnumFontFamiliesExW failed".into());
        }

        fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
        Ok(fonts)
    }
}

// ==================== macOS ====================
#[cfg(target_os = "macos")]
fn get_fonts_macos() -> Result<Vec<FontInfo>, String> {
    use cocoa::foundation::{NSArray, NSString};
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        let manager: *mut objc::runtime::Object =
            msg_send![class!(NSFontManager), sharedFontManager];
        let families: *mut objc::runtime::Object = msg_send![manager, availableFontFamilies];

        let count: usize = msg_send![families, count];
        let mut fonts = Vec::with_capacity(count);

        for i in 0..count {
            let ns_name: *mut objc::runtime::Object = msg_send![families, objectAtIndex: i];
            let c_str: *const std::os::raw::c_char = msg_send![ns_name, UTF8String];
            if !c_str.is_null() {
                let name = std::ffi::CStr::from_ptr(c_str)
                    .to_string_lossy()
                    .to_string();
                fonts.push(FontInfo {
                    family: name,
                    style: String::new(),
                });
            }
        }

        fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
        Ok(fonts)
    }
}

// ==================== Linux ====================
#[cfg(target_os = "linux")]
fn get_fonts_linux() -> Result<Vec<FontInfo>, String> {
    use fontconfig_sys::{
        FcConfigGetCurrent, FcFontList, FcFontSet, FcFontSetDestroy, FcObjectSet, FcObjectSetAdd,
        FcObjectSetCreate, FcObjectSetDestroy, FcPattern, FcPatternCreate, FcPatternDestroy,
        FcPatternGetString, FcResultMatch, FC_FAMILY, FC_STYLE,
    };
    use std::ffi::CStr;
    use std::ptr;

    struct Pattern(*mut FcPattern);

    impl Drop for Pattern {
        fn drop(&mut self) {
            unsafe { FcPatternDestroy(self.0) };
        }
    }

    struct ObjectSet(*mut FcObjectSet);

    impl Drop for ObjectSet {
        fn drop(&mut self) {
            unsafe { FcObjectSetDestroy(self.0) };
        }
    }

    struct FontSet(*mut FcFontSet);

    impl Drop for FontSet {
        fn drop(&mut self) {
            unsafe { FcFontSetDestroy(self.0) };
        }
    }

    let _fontconfig = fontconfig::Fontconfig::new()
        .ok_or_else(|| "FontConfig initialization failed".to_owned())?;
    let config = unsafe { FcConfigGetCurrent() };
    if config.is_null() {
        return Err("FontConfig has no active configuration".into());
    }

    let pattern = Pattern(unsafe { FcPatternCreate() });
    if pattern.0.is_null() {
        return Err("Failed to create FontConfig pattern".into());
    }

    let objects = ObjectSet(unsafe { FcObjectSetCreate() });
    if objects.0.is_null() {
        return Err("Failed to create FontConfig object set".into());
    }
    if unsafe { FcObjectSetAdd(objects.0, FC_FAMILY.as_ptr()) } == 0
        || unsafe { FcObjectSetAdd(objects.0, FC_STYLE.as_ptr()) } == 0
    {
        return Err("Failed to configure FontConfig font properties".into());
    }

    let font_set = FontSet(unsafe { FcFontList(config, pattern.0, objects.0) });
    if font_set.0.is_null() {
        return Err("Failed to list system fonts".into());
    }

    let mut fonts = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let font_set_ref = unsafe { &*font_set.0 };

    for index in 0..font_set_ref.nfont.max(0) as usize {
        let font = unsafe { *font_set_ref.fonts.add(index) };
        let mut family_ptr = ptr::null_mut();
        if unsafe { FcPatternGetString(font, FC_FAMILY.as_ptr(), 0, &mut family_ptr) }
            == FcResultMatch
            && !family_ptr.is_null()
        {
            let family = unsafe { CStr::from_ptr(family_ptr.cast()) }
                .to_string_lossy()
                .into_owned();
            if seen.insert(family.clone()) {
                let mut style_ptr = ptr::null_mut();
                let style =
                    if unsafe { FcPatternGetString(font, FC_STYLE.as_ptr(), 0, &mut style_ptr) }
                        == FcResultMatch
                        && !style_ptr.is_null()
                    {
                        unsafe { CStr::from_ptr(style_ptr.cast()) }
                            .to_string_lossy()
                            .into_owned()
                    } else {
                        String::new()
                    };
                fonts.push(FontInfo { family, style });
            }
        }
    }

    fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
    Ok(fonts)
}
