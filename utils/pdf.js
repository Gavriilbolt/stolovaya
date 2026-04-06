const fs = require('fs');
const path = require('path');

function getBundledFontPath() {
    return path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
}

function getSystemFallbackFontPath() {
    if (process.platform !== 'win32') {
        return null;
    }

    const candidates = [
        path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf'),
        path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'calibri.ttf')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

function resolveFontPath() {
    const explicit = (process.env.PDF_FONT_FILE || '').trim();
    if (explicit && fs.existsSync(explicit)) {
        return explicit;
    }

    const bundled = getBundledFontPath();
    if (fs.existsSync(bundled)) {
        return bundled;
    }

    return getSystemFallbackFontPath();
}

function applyUnicodeFont(doc) {
    const fontPath = resolveFontPath();
    if (!fontPath) {
        return;
    }

    doc.font(fontPath);
}

module.exports = {
    applyUnicodeFont,
    resolveFontPath
};

