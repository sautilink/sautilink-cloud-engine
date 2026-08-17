function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function accountShell(title, body) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#16181d"><table role="presentation" width="100%"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e8ec;border-radius:16px"><tr><td style="padding:30px 36px;border-bottom:1px solid #edf0f3"><img src="https://sautilink.com/logo.png" width="150" alt="SautiLink" style="display:block;width:150px;height:auto"><div style="margin-top:10px;font-size:11px;font-weight:700;color:#7b818c;text-transform:uppercase;letter-spacing:1px">SautiLink Corporation</div></td></tr><tr><td style="padding:30px 36px"><h1 style="margin:0 0 14px;font-size:25px">${escapeHtml(title)}</h1>${body}</td></tr><tr><td style="padding:24px 36px;border-top:1px solid #e8eaee;font-size:12px;line-height:1.7;color:#6f7580">Official SautiLink email addresses use the <strong>@sautilink.com</strong> domain. SautiLink representatives will never ask for your password or verification code.</td></tr><tr><td style="background:#f8f9fb;border-top:1px solid #e8eaee;padding:26px 36px;font-size:12px;line-height:1.7;color:#7b818c"><strong>SautiLink Corporation</strong><br>Uhuru Street<br>Mwanza, Tanzania<br><br>Automated account message from <strong>noreply@sautilink.com</strong>.<br>© SautiLink Corporation. All rights reserved.</td></tr></table></td></tr></table></body></html>`;
}

export function accountVerifiedEmail({ fullName, username } = {}) {
  const name = escapeHtml(fullName || "there");
  const handle = username ? `@${escapeHtml(username)}` : "your SautiLink Account";
  return {
    subject: "Your SautiLink Account is verified",
    htmlbody: accountShell(
      "Your account is verified",
      `<p style="font-size:15px;line-height:1.7;color:#555b66">Hello ${name}, your email address has been verified and ${handle} is now active.</p><div style="padding:16px;background:#eef7ff;border:1px solid #d7e9ff;border-radius:10px;font-size:13px;line-height:1.7;color:#40546b"><strong>Email verified</strong><br>Your account can now use signed-in SautiLink experiences. Cloud Engine scan history will become available when the 30-day history phase is enabled.</div><p style="margin-top:20px;font-size:13px;line-height:1.7;color:#7a808b">This is an account transaction, not a marketing email. Your product-update preference remains separate and can be changed from your account settings.</p>`
    ),
    textbody: `Hello ${fullName || "there"}. Your SautiLink Account${username ? ` @${username}` : ""} is verified. This is an account transaction, not a marketing email.`,
  };
}
