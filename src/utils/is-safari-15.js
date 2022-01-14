export default function isSafari15 (browserInfo) {
    return browserInfo &&
        browserInfo.browserName === 'safari' &&
        browserInfo.version === '15';
}
