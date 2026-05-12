## 2024-05-12 - Prevent XSS in HTML Interpolation
**Vulnerability:** User inputs were directly interpolated into HTML strings rendered via `innerHTML`.
**Learning:** The application heavily relies on `innerHTML` for dynamic rendering without any escaping mechanism, leaving it vulnerable to XSS.
**Prevention:** Always use a global `escapeHTML` function to sanitize any user-provided string before injecting it into an `innerHTML` template, or prefer setting `textContent` where applicable.
