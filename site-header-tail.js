// Shared header markup: sign-in form, account/plan button, quick-links, plan selector.
// One file instead of ~26 hand-copied blocks — edit this, not every page. See
// site-header-brand.js for the loading mechanism (synchronous document.write, no build step).
//
// index.html keeps its own hand-written header (it adds a Reminders checkbox to the sign-in
// form that no other page has) — deliberately excluded from this shared block.
//
// Mobile rules loaded here (not per-page) for the same reason as site-header-brand.js's —
// see that file's comment for how the cascade-order override works.
document.write(`
<style>
@media (max-width: 1100px) {
    .plan-badge-group { align-items: stretch; width: 100%; }
    .header-sign-in { align-items: stretch; }
    .header-sign-in-row { flex-wrap: wrap; }
    .header-sign-in-input { flex: 1 1 120px; width: auto; }
    .header-sign-in-mode-toggle { text-align: center; }
    .account-btn { justify-content: center; }
    .header-quick-links { align-items: center; }
    .header-quick-links-row { flex-wrap: wrap; justify-content: center; }
    .plan-select { width: 100%; }
}
</style>
`);

document.write(`
<div class="plan-badge-group">
    <div class="header-sign-in" id="headerSignIn" title="Sign in or create a free Kerph account.">
        <div class="header-sign-in-row">
            <input type="email" class="header-sign-in-input" id="headerSignInEmail" placeholder="Email" autocomplete="email">
            <input type="password" class="header-sign-in-input" id="headerSignInPassword" placeholder="Password" autocomplete="current-password">
            <button type="button" id="headerSignInBtn" class="mini-btn" title="Sign In">Sign In</button>
        </div>
        <a href="#" class="header-sign-in-mode-toggle" id="headerSignInModeToggle">New here? Create an account</a>
        <a href="#" class="header-sign-in-mode-toggle" id="headerForgotPasswordLink">Forgot password?</a>
    </div>
    <button type="button" id="accountBtn" class="account-btn plan-free" title="Account &amp; Plan Settings &mdash; border color shows your plan level" style="display:none;">
        <span class="account-avatar" id="accountAvatarPreview">&#128100;</span>
        <span class="account-btn-text">
            <span class="account-btn-name" id="accountBtnLabel">Account</span>
            <span class="account-btn-plan" id="accountBtnPlan">Free</span>
        </span>
    </button>
    <div class="header-quick-links">
        <div class="header-quick-links-row">
            <a href="pricing.html">Plan Comparison</a>
            <span class="header-quick-links-sep">&middot;</span>
            <a href="follow.html">Follow Us</a>
        </div>
        <a href="help.html">Trouble with the Kerph</a>
    </div>
    <select class="plan-select" id="planSelector" style="display:none;">
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="premier">Premier</option>
    </select>
</div>
`);
