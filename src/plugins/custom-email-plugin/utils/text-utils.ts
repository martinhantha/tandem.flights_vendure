/**
 * Converts the line breaks of plain-text input (e.g. a textblock typed into the dashboard
 * textarea) into <br /> tags, since the email templates render them as HTML where
 * consecutive whitespace is collapsed.
 */
export function nl2br(value: string) {
    return (value ?? "").replace(/\r\n|\r|\n/g, "<br />")
}
