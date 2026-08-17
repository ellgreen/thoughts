// navigator.platform is deprecated and userAgentData is Chromium-only, so this
// sniffs the UA. Getting it wrong only mislabels a hint — both modifiers are
// accepted wherever one is.
const isApple = /mac|iphone|ipad|ipod/i.test(navigator.userAgent);

export const modKey = isApple ? "⌘" : "Ctrl";
