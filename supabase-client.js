// Shared Supabase client + auth helpers, loaded by every page via
// <script src="supabase-client.js"> (same sharing pattern as catalog-data.js).
// This is the first real backend Kerph has — replaces the old fake
// kerphSignedIn/kerphAccount localStorage-only "sign in."
//
// Named kerphSupabase (not `supabase`) since the CDN's UMD build already
// exposes a global `window.supabase` — reusing that name would shadow it.
(function () {
    const SUPABASE_URL = 'https://qawfiktqeoarnvsarejo.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CwFT2DmnLf9m900zFPROWg_bOYRTIh-';

    const kerphSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    // Synchronous cache — ~65+ call sites across every page read sign-in/account state
    // synchronously today (loadAccount() alone is called 71 times across 11 files), so
    // this cache is what lets isSignedIn()/loadAccount() stay synchronous instead of
    // needing every call site converted to async/await.
    const state = { user: null, profile: null, ready: false };

    // Real (not localStorage-preview) entitlement, refreshed on every auth event — see
    // kerphGetCachedEffectivePlan() below for why this is a synchronous-readable cache rather
    // than something the ~26 pages' worth of call sites each await individually.
    let cachedEffectivePlan = { plan: 'free', viaTeam: false };

    let resolveReady;
    // Every page's init sequence should `await kerphAuthReady` before rendering
    // signed-in/signed-out UI, or an actually-signed-in user sees a flash of the
    // signed-out header on every load (session restore isn't instant).
    const kerphAuthReady = new Promise((resolve) => { resolveReady = resolve; });

    const changeListeners = [];
    function notifyChange() {
        changeListeners.forEach((cb) => {
            try { cb(state.user, state.profile); } catch (e) { /* one bad listener shouldn't break the rest */ }
        });
    }

    async function refreshProfile(userId) {
        if (!userId) { state.profile = null; return; }
        const { data, error } = await kerphSupabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (!error && data) state.profile = data;
    }

    // Deadlock avoidance: calling another kerphSupabase method directly inside this
    // callback is a documented, real bug (Supabase's own troubleshooting guide + GitHub
    // issues supabase/auth-js#762 and supabase/supabase-js#1594) that hangs every
    // subsequent Supabase call on the page until reload. The setTimeout(..., 0) deferral
    // is Supabase's own documented workaround, not a stylistic choice — do not remove it.
    //
    // migrationAttempted guards against a real race: Supabase can fire two auth events
    // back-to-back on a fresh load (e.g. INITIAL_SESSION + SIGNED_IN) whose setTimeout(...,0)
    // callbacks both read `wasReady` as false before either has set state.ready — verified
    // live, this caused kerphRunLocalMigration() to run twice concurrently and double-insert
    // every migrateCollection() row (saved_layouts, saved_projects). migrateSingleton()'s
    // upserts happened to mask the same race. This flag is set synchronously (no await
    // between the check and the set), so the second callback's check always sees it in time.
    let migrationAttempted = false;
    kerphSupabase.auth.onAuthStateChange((event, session) => {
        setTimeout(async () => {
            const wasReady = state.ready;
            state.user = session ? session.user : null;
            if (state.user) kerphLogDailyActiveUser(state.user.id);
            await refreshProfile(state.user ? state.user.id : null);
            if (state.user) {
                await kerphBackfillProfileFromSignupMetadata();
            }
            kerphSyncAdminDashboardLink();
            // Real entitlement resolution — direct subscription, or Premier inherited via an
            // active team membership. Refreshed on every auth event (sign-in, sign-out, token
            // refresh) so it never lags behind who's actually signed in.
            if (state.user) {
                const { data: eff } = await kerphGetMyEffectivePlan();
                cachedEffectivePlan = { plan: eff.plan, viaTeam: !!eff.viaTeam };
            } else {
                cachedEffectivePlan = { plan: 'free', viaTeam: false };
            }
            // Only on the very first ready-resolution of a real sign-in (not every later
            // auth event) — kerphRunLocalMigration itself is a fast no-op after the first
            // time via its own sentinel, but this also skips it during INITIAL_SESSION
            // signed-out resolution and other no-op events.
            if (!wasReady && state.user && !migrationAttempted) {
                migrationAttempted = true;
                await kerphRunLocalMigration();
            }
            if (!state.ready) {
                state.ready = true;
                resolveReady();
            }
            kerphRefreshTierLocks();
            notifyChange();
        }, 0);
    });

    // metadata (e.g. { full_name, username, referral_source }) is stored by Supabase on the
    // auth.users row itself (available afterward as session.user.user_metadata) -- unlike
    // localStorage, it survives regardless of which device/browser the user ends up
    // confirming their email and signing in from.
    async function kerphSignUp(email, password, metadata) {
        const { data, error } = await kerphSupabase.auth.signUp({
            email, password,
            options: metadata ? { data: metadata } : undefined
        });
        if (error) return { error };
        // Supabase deliberately returns an obfuscated non-error "success" for an email
        // that's already registered (anti-enumeration behavior) — without this check, a
        // mistyped "sign up" on an existing account silently tells the user to check an
        // email that will never arrive, instead of prompting them to sign in.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return { error: { message: 'An account with this email already exists. Try signing in instead.' } };
        }
        return { data, needsConfirmation: !data.session };
    }

    async function kerphSignIn(email, password) {
        return kerphSupabase.auth.signInWithPassword({ email, password });
    }

    async function kerphSignOut() {
        await kerphSupabase.auth.signOut();
    }

    // Sends a recovery-link email via Supabase Auth; the link lands the user on
    // reset-password.html with a recovery session already active. redirectTo must be
    // an allowed Redirect URL in the Supabase Auth settings or the email link 404s.
    async function kerphRequestPasswordReset(email) {
        return kerphSupabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password.html`
        });
    }

    // Used both by reset-password.html (recovery session from the emailed link) and by
    // the "Change Password" field in Account Settings (regular signed-in session) --
    // updateUser() works the same way for either since both are a live Supabase session.
    async function kerphUpdatePassword(newPassword) {
        return kerphSupabase.auth.updateUser({ password: newPassword });
    }

    function kerphGetCachedUser() {
        return state.user;
    }

    // Shape-compatible with the old kerphAccount localStorage record, so the ~65 existing
    // call sites across every page (including shop-showcase.html/tool-catalog.html, which
    // attribution-stamp local-only posts with loadAccount().username) keep working unmodified.
    function kerphGetCachedProfile() {
        if (!state.profile) return {};
        return {
            username: state.profile.username || '',
            fullName: state.profile.full_name || '',
            avatar: state.profile.avatar_data_url || null,
            memberSince: state.profile.created_at || null,
            unitSystem: state.profile.unit_system || 'imperial',
            maintenanceRemindersEnabled: state.profile.maintenance_reminders_enabled !== false,
            homeTileOrder: state.profile.home_tile_order || null,
            homeTileHidden: state.profile.home_tile_hidden || [],
            isAdmin: state.profile.is_admin === true
        };
    }

    function kerphIsAdmin() {
        return kerphGetCachedProfile().isAdmin === true;
    }

    // Admin-only link to admin.html, injected into the Account Settings modal rather than the
    // shared site nav (which is loaded for every visitor on every page) -- keeps the dashboard
    // undiscoverable to non-admins while still being reachable without remembering a bare URL.
    // #accountSignOutBtn exists in all 27 pages' account-modal markup (verified), so it's a
    // reliable anchor regardless of which page this runs on. Called on every auth event rather
    // than once, so it's added/removed correctly if the same browser session ever switches
    // between an admin and a non-admin account without a full page reload.
    function kerphSyncAdminDashboardLink() {
        const signOutBtn = document.getElementById('accountSignOutBtn');
        if (!signOutBtn) return;
        const existing = document.getElementById('accountAdminDashboardLink');
        if (kerphIsAdmin()) {
            if (existing) return;
            const link = document.createElement('a');
            link.id = 'accountAdminDashboardLink';
            link.href = 'admin.html';
            link.className = 'mini-btn';
            link.style.cssText = 'display:block; width:100%; margin-top:8px; text-align:center; text-decoration:none; box-sizing:border-box;';
            link.textContent = '\u{1F4CA} Admin Dashboard';
            signOutBtn.insertAdjacentElement('beforebegin', link);
        } else if (existing) {
            existing.remove();
        }
    }

    // upsert (not update) so a missing profile row — trigger failure, edge case, whatever —
    // never permanently locks a signed-in user out of saving; the INSERT RLS policy exists
    // specifically to make this self-healing path work.
    async function kerphSaveProfile({ username, fullName, avatarDataUrl, unitSystem, maintenanceRemindersEnabled, homeTileOrder, homeTileHidden, referralSource } = {}) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        const updates = { id: state.user.id, username };
        if (fullName !== undefined) updates.full_name = fullName;
        if (avatarDataUrl !== undefined) updates.avatar_data_url = avatarDataUrl;
        if (unitSystem !== undefined) updates.unit_system = unitSystem;
        if (maintenanceRemindersEnabled !== undefined) updates.maintenance_reminders_enabled = maintenanceRemindersEnabled;
        if (homeTileOrder !== undefined) updates.home_tile_order = homeTileOrder;
        if (homeTileHidden !== undefined) updates.home_tile_hidden = homeTileHidden;
        if (referralSource !== undefined) updates.referral_source = referralSource;
        const { data, error } = await kerphSupabase.from('profiles').upsert(updates).select().maybeSingle();
        if (!error && data) {
            state.profile = data;
            notifyChange();
        }
        return { data, error };
    }

    function kerphOnAuthChange(callback) {
        changeListeners.push(callback);
    }

    // Downscales an image file to maxDim on its longest side, returns Promise<dataURL>.
    // Avatars used to be pure-local (harmless at any size); now they're fetched over the
    // network on every page load via the profile row, so an unresized phone photo is a
    // real cost it wasn't before. Quality 0.85 JPEG keeps this cheap without a visible hit.
    function kerphDownscaleImage(file, maxDim) {
        maxDim = maxDim || 200;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    let { width, height } = img;
                    if (width > height && width > maxDim) {
                        height = Math.round(height * maxDim / width);
                        width = maxDim;
                    } else if (height > maxDim) {
                        width = Math.round(width * maxDim / height);
                        height = maxDim;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Shown once right after a brand-new account is created (not on ordinary sign-in) — a
    // dismissible, non-blocking nudge toward the Kerph YouTube channel. Deliberately never a
    // requirement to use Free tier: YouTube's Fake Engagement policy prohibits gating access
    // behind a forced subscribe, but explicitly allows just encouraging it, which is all this
    // does — the modal closes via the X, "Maybe later", or a backdrop click, no action is
    // required. Built with inline styles instead of a page's own CSS classes so it works
    // identically on every page without needing matching markup/CSS added everywhere.
    const KERPH_YOUTUBE_HANDLE = 'kerphplans';
    // Set to a real YouTube video ID once the full-platform walkthrough is recorded and
    // published — the video area below switches from the "coming soon" placeholder to a
    // real embedded player automatically the moment this is non-empty.
    const KERPH_WALKTHROUGH_VIDEO_ID = '';
    function kerphShowSubscribePrompt() {
        if (document.getElementById('kerphSubscribePrompt')) return;
        const el = document.createElement('div');
        el.id = 'kerphSubscribePrompt';
        el.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:5000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        const videoHtml = KERPH_WALKTHROUGH_VIDEO_ID
            ? `<iframe width="100%" height="100%" style="position:absolute; inset:0; border:0;" src="https://www.youtube-nocookie.com/embed/${KERPH_WALKTHROUGH_VIDEO_ID}" title="Kerph walkthrough" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
            : `<div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;">
                   <div style="width:56px; height:56px; border-radius:50%; background:rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; font-size:20px; color:#fff;">&#9654;</div>
                   <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Full walkthrough coming soon</div>
               </div>`;
        el.innerHTML = `
            <div style="background:#0f172a; color:#fff; border-radius:16px; box-shadow:0 25px 60px rgba(0,0,0,0.5); max-width:420px; width:100%; overflow:hidden; position:relative;">
                <button type="button" aria-label="Dismiss" style="position:absolute; top:10px; right:10px; z-index:1; background:rgba(15,23,42,0.6); border:none; color:#fff; font-size:16px; line-height:1; width:26px; height:26px; border-radius:50%; cursor:pointer;">&times;</button>
                <div style="position:relative; aspect-ratio:16/9; background:linear-gradient(135deg,#1e293b,#0f172a); border-bottom:1px solid #1e293b;">${videoHtml}</div>
                <div style="padding:20px 22px 22px;">
                    <div style="font-size:17px; font-weight:800; margin-bottom:6px;">Welcome to Kerph!</div>
                    <div style="font-size:13.5px; line-height:1.6; color:#cbd5e1; margin-bottom:16px;">We're building full video walkthroughs of every feature &mdash; subscribe on YouTube so you don't miss them, plus shop tips and new-feature drops as they ship.</div>
                    <a href="https://www.youtube.com/@${KERPH_YOUTUBE_HANDLE}?sub_confirmation=1" target="_blank" rel="noopener" style="display:block; text-align:center; background:#dc2626; color:#fff; font-weight:800; font-size:14px; padding:12px; border-radius:8px; text-decoration:none;">Subscribe on YouTube &#8599;</a>
                    <button type="button" data-dismiss style="display:block; width:100%; text-align:center; background:none; border:none; color:#94a3b8; font-size:12.5px; margin-top:10px; cursor:pointer; padding:4px;">Maybe later</button>
                </div>
            </div>
        `;
        function close() { el.remove(); }
        el.querySelector('button[aria-label="Dismiss"]').addEventListener('click', close);
        el.querySelector('button[data-dismiss]').addEventListener('click', close);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        document.body.appendChild(el);
    }

    // Full sign-up modal: name, email, password, and "how did you hear about us" all collected
    // in one step at account creation -- replaces both the old bare header-form signup (which
    // only asked for email/password) and a separate post-signup referral nag (which kept
    // resurfacing on every sign-in until answered, which is exactly the "shows all the time"
    // problem this replaces). Triggered by intercepting the header sign-in form's Sign-Up path
    // (see the capture-phase listeners below) rather than editing every page's own copy of that
    // form, since that markup/JS is independently duplicated across ~26 pages.
    // Kept in sync with the real accounts listed in follow.html's SOCIAL_PLATFORMS -- update
    // both places together if an account is ever added, renamed, or dropped.
    // Adds a click-to-reveal eye icon to any password field, wired to any input regardless
    // of its surrounding layout (the tiny 84px header field and the full-width sign-up modal
    // field need different wrapper behavior). Never touches the input's own width -- some
    // callers (the header field) have responsive CSS keyed off width via media queries, and
    // an inline style would win over that and break it. Idempotent, safe to call more than
    // once on the same input.
    function kerphAddPasswordToggle(inputEl, opts) {
        if (!inputEl || inputEl.dataset.kerphToggleAdded === 'true') return;
        inputEl.dataset.kerphToggleAdded = 'true';
        const block = !!(opts && opts.block);

        const wrapper = document.createElement(block ? 'div' : 'span');
        wrapper.style.position = 'relative';
        wrapper.style.display = block ? 'block' : 'inline-block';
        if (block) wrapper.style.width = '100%';
        inputEl.parentNode.insertBefore(wrapper, inputEl);
        wrapper.appendChild(inputEl);

        const existingPaddingRight = parseInt(getComputedStyle(inputEl).paddingRight, 10) || 0;
        inputEl.style.paddingRight = (existingPaddingRight + 30) + 'px';
        inputEl.style.boxSizing = 'border-box';

        // Touch target is deliberately bigger than the visible icon (32x32 vs. a ~13px
        // glyph) -- a mobile audit found the original tight-padding version rendered at
        // ~22x17px, well under the ~44px minimum tap-target guidance from Apple/Google/WCAG.
        // Centering the small icon in a larger invisible hit area is the standard fix rather
        // than making the icon itself bigger, which would look oversized in these tight fields.
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '\u{1F441}️';
        btn.title = 'Show password';
        btn.setAttribute('aria-label', 'Show password');
        btn.style.cssText = 'position:absolute; right:0; top:50%; transform:translateY(-50%); display:flex; align-items:center; justify-content:center; min-width:32px; min-height:32px; border:none; background:none; cursor:pointer; padding:0; font-size:13px; line-height:1; opacity:0.55;';
        btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
        btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.55'; });
        btn.addEventListener('click', () => {
            const revealing = inputEl.type === 'password';
            inputEl.type = revealing ? 'text' : 'password';
            btn.textContent = revealing ? '\u{1F648}' : '\u{1F441}️';
            const label = revealing ? 'Hide password' : 'Show password';
            btn.title = label;
            btn.setAttribute('aria-label', label);
        });
        wrapper.appendChild(btn);
    }
    window.kerphAddPasswordToggle = kerphAddPasswordToggle;

    const KERPH_REFERRAL_OPTIONS = ['Google / Search', 'Instagram', 'Facebook', 'YouTube', 'Pinterest', 'X (Twitter)', 'Word of mouth', 'Reddit', 'Woodworking forum', 'Other', 'Prefer not to say'];
    const KERPH_MODAL_LABEL_STYLE = 'display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#6b7280; margin:12px 0 4px;';
    const KERPH_MODAL_INPUT_STYLE = 'width:100%; padding:9px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13.5px; font-weight:600; box-sizing:border-box;';
    function kerphShowSignUpModal(prefillEmail, prefillPassword) {
        if (document.getElementById('kerphSignUpModal')) return;
        const el = document.createElement('div');
        el.id = 'kerphSignUpModal';
        el.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:5000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        el.innerHTML = `
            <div style="background:#fff; border-radius:14px; box-shadow:0 25px 60px rgba(0,0,0,0.4); max-width:380px; width:100%; padding:24px; position:relative; max-height:90vh; overflow-y:auto; box-sizing:border-box;">
                <button type="button" aria-label="Close" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#9ca3af; font-size:18px; line-height:1; cursor:pointer; padding:4px;">&times;</button>
                <div style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:2px;">Create your Kerph account</div>
                <div style="font-size:12.5px; color:#6b7280;">Free to start &mdash; no card needed.</div>

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="signupNameInput">Name</label>
                <input type="text" id="signupNameInput" placeholder="Your name" style="${KERPH_MODAL_INPUT_STYLE}">

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="signupEmailInput">Email</label>
                <input type="email" id="signupEmailInput" placeholder="you@example.com" style="${KERPH_MODAL_INPUT_STYLE}">

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="signupPasswordInput">Password</label>
                <input type="password" id="signupPasswordInput" style="${KERPH_MODAL_INPUT_STYLE}">

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="signupReferralSelect">How did you hear about us?</label>
                <select id="signupReferralSelect" style="${KERPH_MODAL_INPUT_STYLE} background:#f8fafc;">
                    <option value="" disabled selected>Choose one&hellip;</option>
                    ${KERPH_REFERRAL_OPTIONS.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>
                <input type="text" id="signupReferralOther" placeholder="Where, specifically?" style="display:none; margin-top:6px; ${KERPH_MODAL_INPUT_STYLE}">

                <div id="signupModalStatus" style="display:none; margin-top:12px; font-size:12px; padding:8px 10px; border-radius:6px;"></div>
                <button type="button" id="signupModalSubmit" style="display:block; width:100%; text-align:center; background:#1e3a8a; color:#fff; border:none; font-weight:700; font-size:14px; padding:11px; border-radius:8px; cursor:pointer; margin-top:16px;">Create Account</button>
            </div>
        `;
        const nameInput = el.querySelector('#signupNameInput');
        const emailInput = el.querySelector('#signupEmailInput');
        const passwordInput = el.querySelector('#signupPasswordInput');
        const referralSelect = el.querySelector('#signupReferralSelect');
        const referralOther = el.querySelector('#signupReferralOther');
        const statusEl = el.querySelector('#signupModalStatus');
        const submitBtn = el.querySelector('#signupModalSubmit');
        emailInput.value = prefillEmail || '';
        passwordInput.value = prefillPassword || '';
        kerphAddPasswordToggle(passwordInput, { block: true });

        referralSelect.addEventListener('change', () => {
            referralOther.style.display = referralSelect.value === 'Other' ? 'block' : 'none';
        });

        function close() { el.remove(); }
        function showStatus(message, ok) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            statusEl.style.color = ok ? '#166534' : '#b91c1c';
            statusEl.style.background = ok ? '#f0fdf4' : '#fef2f2';
            statusEl.style.border = `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`;
        }

        async function submit() {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const referral = referralSelect.value === 'Other' ? (referralOther.value.trim() || 'Other') : referralSelect.value;

            if (!name) { showStatus('Enter your name.'); return; }
            if (!email) { showStatus('Enter an email address.'); return; }
            if (!password) { showStatus('Enter a password.'); return; }
            if (!referral) { showStatus('Choose how you heard about us.'); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating…';
            try {
                const { error, needsConfirmation } = await kerphSignUp(email, password, {
                    full_name: name, username: name, referral_source: referral
                });
                if (error) { showStatus(error.message || 'Sign up failed.'); return; }

                if (needsConfirmation) {
                    // Not signed in yet -- state.user doesn't exist until they confirm and sign
                    // in for real, so this can't be saved via kerphSaveProfile right now. The
                    // name/referral above are already stored as auth user_metadata though, so
                    // kerphBackfillProfileFromSignupMetadata() applies them automatically on
                    // that first real sign-in, from whatever device it happens on.
                    showStatus('Check your email to confirm your account, then sign in.', true);
                    setTimeout(close, 3000);
                } else {
                    await kerphSaveProfile({ username: name, fullName: name, referralSource: referral });
                    close();
                    kerphShowSubscribePrompt();
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        }

        el.querySelector('button[aria-label="Close"]').addEventListener('click', close);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        submitBtn.addEventListener('click', submit);
        [nameInput, emailInput, passwordInput, referralOther].forEach((input) => {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        });
        document.body.appendChild(el);
        nameInput.focus();
    }

    // Explicit "forgot password" modal -- always asks for an email, rather than the old
    // per-page inline handler's behavior of silently reusing whatever the adjacent sign-in
    // email field happened to already contain (stale value, autofill, whatever) with nothing
    // on screen indicating that's what it was about to do. prefillEmail is a convenience only,
    // not a dependency -- the field is always visible and editable before Send does anything.
    function kerphShowForgotPasswordModal(prefillEmail) {
        if (document.getElementById('kerphForgotPasswordModal')) return;
        const el = document.createElement('div');
        el.id = 'kerphForgotPasswordModal';
        el.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:5000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        el.innerHTML = `
            <div style="background:#fff; border-radius:14px; box-shadow:0 25px 60px rgba(0,0,0,0.4); max-width:360px; width:100%; padding:24px; position:relative; box-sizing:border-box;">
                <button type="button" aria-label="Close" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#9ca3af; font-size:18px; line-height:1; cursor:pointer; padding:4px;">&times;</button>
                <div style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:2px;">Reset your password</div>
                <div style="font-size:12.5px; color:#6b7280;">Enter your account email and we'll send a link to set a new password.</div>

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="forgotPasswordEmailInput">Email</label>
                <input type="email" id="forgotPasswordEmailInput" placeholder="you@example.com" style="${KERPH_MODAL_INPUT_STYLE}">

                <div id="forgotPasswordModalStatus" style="display:none; margin-top:12px; font-size:12px; padding:8px 10px; border-radius:6px;"></div>
                <button type="button" id="forgotPasswordModalSubmit" style="display:block; width:100%; text-align:center; background:#1e3a8a; color:#fff; border:none; font-weight:700; font-size:14px; padding:11px; border-radius:8px; cursor:pointer; margin-top:16px;">Send Reset Link</button>
            </div>
        `;
        const emailInput = el.querySelector('#forgotPasswordEmailInput');
        const statusEl = el.querySelector('#forgotPasswordModalStatus');
        const submitBtn = el.querySelector('#forgotPasswordModalSubmit');
        emailInput.value = prefillEmail || '';

        function close() { el.remove(); }
        function showStatus(message, ok) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            statusEl.style.color = ok ? '#166534' : '#b91c1c';
            statusEl.style.background = ok ? '#f0fdf4' : '#fef2f2';
            statusEl.style.border = `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`;
        }

        async function submit() {
            const email = emailInput.value.trim();
            if (!email || !email.includes('@')) { showStatus('Enter a valid email address.'); return; }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending…';
            try {
                const { error } = await kerphRequestPasswordReset(email);
                if (error) { showStatus(error.message || 'Could not send reset email.'); return; }
                showStatus('Check your email for a password reset link.', true);
                setTimeout(close, 3000);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Reset Link';
            }
        }

        el.querySelector('button[aria-label="Close"]').addEventListener('click', close);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        submitBtn.addEventListener('click', submit);
        emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        document.body.appendChild(el);
        emailInput.focus();
    }

    // Every page's header sign-in form is independently duplicated markup+JS (~26 copies), so
    // rather than edit the Sign-Up path into all of them, this intercepts it centrally: the
    // header button's own text ("Sign Up" vs "Sign In") is the one reliable signal of which
    // mode a given page's form is currently in, readable from outside that page's closure.
    // Capture-phase + stopImmediatePropagation() so the page's own attemptSubmit() (bound in
    // the bubble phase, direct on the button/inputs) never runs for a sign-up attempt -- Sign
    // In is untouched and still goes through each page's normal flow.
    function kerphIsSignUpModeActive() {
        const btn = document.getElementById('headerSignInBtn');
        return !!btn && btn.textContent.trim() === 'Sign Up';
    }
    function kerphInterceptSignUp(e) {
        if (!kerphIsSignUpModeActive()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const emailInput = document.getElementById('headerSignInEmail');
        const passwordInput = document.getElementById('headerSignInPassword');
        kerphShowSignUpModal(emailInput ? emailInput.value.trim() : '', passwordInput ? passwordInput.value : '');
    }
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'headerSignInBtn') kerphInterceptSignUp(e);
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target && (e.target.id === 'headerSignInEmail' || e.target.id === 'headerSignInPassword')) {
            kerphInterceptSignUp(e);
        }
    }, true);

    // Same centralized-interception pattern as Sign Up above -- "Forgot password?" is likewise
    // independently duplicated per-page, and its old inline handler just silently reused
    // whatever the adjacent sign-in email field happened to contain. Intercepted centrally so
    // the explicit modal opens on every page without editing ~27 duplicated copies.
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'headerForgotPasswordLink') {
            e.preventDefault();
            e.stopImmediatePropagation();
            const emailInput = document.getElementById('headerSignInEmail');
            kerphShowForgotPasswordModal(emailInput ? emailInput.value.trim() : '');
        }
    }, true);

    // Backfills username/full_name/referral_source from the signup-time auth metadata (set via
    // signUp()'s options.data above) the first time we see a profile that doesn't have a name
    // yet. Runs on every sign-in; cheap no-op once full_name is actually set. This replaced a
    // localStorage-based handoff that silently failed whenever email confirmation happened on a
    // different device/browser than the one signup started on (a common real case, e.g. signing
    // up on desktop and confirming from a phone) — user_metadata lives on the auth user record
    // itself, so it's there on every sign-in from every device, not just the original one.
    async function kerphBackfillProfileFromSignupMetadata() {
        if (!state.user) return;
        const meta = state.user.user_metadata || {};
        if (!meta.full_name || (state.profile && state.profile.full_name)) return;
        await kerphSaveProfile({
            username: (state.profile && state.profile.username) || meta.username || meta.full_name,
            fullName: meta.full_name,
            referralSource: meta.referral_source
        }).catch(() => {});
    }

    // Sitewide footer -- injected here (not added to ~26 pages' own HTML) for the same reason
    // as the sign-up interception above: one shared source of truth instead of duplicated
    // markup. Normal document flow (not position:fixed), so it can never overlap the floating
    // toolbars/panels several canvas-heavy pages already have.
    function kerphInjectFooter() {
        if (document.getElementById('kerphSiteFooter')) return;
        const el = document.createElement('footer');
        el.id = 'kerphSiteFooter';
        el.style.cssText = 'text-align:center; padding:22px 16px; margin-top:20px; border-top:1px solid #e2e8f0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:12px; color:#9ca3af;';
        el.innerHTML = `
            <div>
                <a href="terms.html" style="color:#6b7280; font-weight:600; text-decoration:none;">Terms &amp; Privacy</a>
                <span style="color:#cbd5e1; margin:0 8px;">&middot;</span>
                <a href="#" id="kerphFooterContactLink" style="color:#6b7280; font-weight:600; text-decoration:none;">Contact Us</a>
            </div>
            <div style="margin-top:6px;">&copy; ${new Date().getFullYear()} Kerph</div>
            <div style="margin-top:6px; max-width:480px; margin-left:auto; margin-right:auto;">As an Amazon Associate, Kerph earns from qualifying purchases.</div>
        `;
        document.body.appendChild(el);
        el.querySelector('#kerphFooterContactLink').addEventListener('click', (e) => {
            e.preventDefault();
            kerphShowContactModal();
        });
    }

    const KERPH_CONTACT_REASONS = ['Suggest a feature', 'Report a bug or issue', 'Billing or subscription question', 'Partnership or business inquiry', 'Press or media inquiry', 'General question', 'Other'];
    function kerphShowContactModal() {
        if (document.getElementById('kerphContactModal')) return;
        const el = document.createElement('div');
        el.id = 'kerphContactModal';
        el.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:5000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        const cachedUser = (typeof kerphGetCachedUser === 'function') ? kerphGetCachedUser() : null;
        el.innerHTML = `
            <div style="background:#fff; border-radius:14px; box-shadow:0 25px 60px rgba(0,0,0,0.4); max-width:380px; width:100%; padding:24px; position:relative; max-height:90vh; overflow-y:auto; box-sizing:border-box;">
                <button type="button" aria-label="Close" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#9ca3af; font-size:18px; line-height:1; cursor:pointer; padding:4px;">&times;</button>
                <div style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:2px;">Contact Us</div>
                <div style="font-size:12.5px; color:#6b7280;">We'll reply to the email address you enter below.</div>

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="contactEmailInput">Your email</label>
                <input type="email" id="contactEmailInput" placeholder="you@example.com" style="${KERPH_MODAL_INPUT_STYLE}">

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="contactReasonSelect">Reason for contacting us</label>
                <select id="contactReasonSelect" style="${KERPH_MODAL_INPUT_STYLE} background:#f8fafc;">
                    <option value="" disabled selected>Choose one&hellip;</option>
                    ${KERPH_CONTACT_REASONS.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>

                <label style="${KERPH_MODAL_LABEL_STYLE}" for="contactMessageInput">Message</label>
                <textarea id="contactMessageInput" rows="4" style="${KERPH_MODAL_INPUT_STYLE} resize:vertical; font-family:inherit;"></textarea>

                <div id="contactModalStatus" style="display:none; margin-top:12px; font-size:12px; padding:8px 10px; border-radius:6px;"></div>
                <button type="button" id="contactModalSubmit" style="display:block; width:100%; text-align:center; background:#1e3a8a; color:#fff; border:none; font-weight:700; font-size:14px; padding:11px; border-radius:8px; cursor:pointer; margin-top:16px;">Send</button>
            </div>
        `;
        const emailInput = el.querySelector('#contactEmailInput');
        const reasonSelect = el.querySelector('#contactReasonSelect');
        const messageInput = el.querySelector('#contactMessageInput');
        const statusEl = el.querySelector('#contactModalStatus');
        const submitBtn = el.querySelector('#contactModalSubmit');
        if (cachedUser && cachedUser.email) emailInput.value = cachedUser.email;

        function close() { el.remove(); }
        function showStatus(message, ok) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            statusEl.style.color = ok ? '#166534' : '#b91c1c';
            statusEl.style.background = ok ? '#f0fdf4' : '#fef2f2';
            statusEl.style.border = `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`;
        }

        async function submit() {
            const email = emailInput.value.trim();
            const reason = reasonSelect.value;
            const message = messageInput.value.trim();
            if (!email || !email.includes('@')) { showStatus('Enter a valid email.'); return; }
            if (!reason) { showStatus('Choose a reason for contacting us.'); return; }
            if (!message) { showStatus('Enter a message.'); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending…';
            try {
                const resp = await fetch(`${kerphSupabase.supabaseUrl}/functions/v1/contact-us`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, reason, message, pageContext: location.pathname, userId: cachedUser ? cachedUser.id : null }),
                });
                const result = await resp.json().catch(() => ({}));
                if (!resp.ok || result.error) { showStatus(result.error || 'Could not send your message.'); return; }
                showStatus("Message sent — we'll get back to you soon.", true);
                setTimeout(close, 2000);
            } catch (err) {
                showStatus('Could not send your message. Try again in a moment.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send';
            }
        }

        el.querySelector('button[aria-label="Close"]').addEventListener('click', close);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        submitBtn.addEventListener('click', submit);
        document.body.appendChild(el);
    }
    kerphInjectFooter();
    // The shared header's password field (site-header-tail.js, and index.html's own copy of
    // the same markup/ID) is present in the DOM by the time this script runs, since the header
    // is injected via a synchronous document.write earlier in <body>.
    kerphAddPasswordToggle(document.getElementById('headerSignInPassword'));

    // Retrofits a "Your Name" field into the Account Settings modal (identical markup
    // duplicated across ~27 pages) without editing every page's own copy -- same pattern
    // as kerphInjectFooter. Needed because the sign-up modal only collects a name for
    // brand-new accounts; anyone who already had an account before that shipped had no
    // way to add one afterward, and the "Welcome back" greeting silently fell back to
    // their username with no indication anything was missing.
    function kerphInjectFullNameField() {
        const usernameField = document.getElementById('accountUsernameInput');
        if (!usernameField || document.getElementById('accountFullNameInput')) return;
        const usernameWrapper = usernameField.closest('.header-field');
        if (!usernameWrapper || !usernameWrapper.parentNode) return;
        const fullNameWrapper = document.createElement('div');
        fullNameWrapper.className = 'header-field';
        fullNameWrapper.style.cssText = 'display:flex; flex-direction:column; gap:4px; margin-top:12px;';
        fullNameWrapper.innerHTML = `
            <label class="header-field-label" for="accountFullNameInput">Your Name</label>
            <input type="text" class="input-box" id="accountFullNameInput" placeholder="Used for &quot;Welcome back&quot; on the home page">
        `;
        usernameWrapper.parentNode.insertBefore(fullNameWrapper, usernameWrapper);
    }
    kerphInjectFullNameField();

    // These fire on document, so they always run *after* each page's own click handler
    // bound directly to the button (target-phase listeners fire before the event bubbles
    // up to document) -- by the time these run, the modal is already open/populated or
    // the page's own Save call has already fired, so this only needs to handle the one
    // field it owns.
    document.addEventListener('click', (e) => {
        const fullNameInput = document.getElementById('accountFullNameInput');
        if (!fullNameInput) return;
        if (e.target.closest('#accountBtn')) {
            fullNameInput.value = (kerphGetCachedProfile().fullName) || '';
        } else if (e.target.closest('#accountSaveBtn')) {
            kerphSaveProfile({ fullName: fullNameInput.value.trim() });
        }
    });

    /* ---------- Singleton domains: one row per user, upsert-only ---------- */

    function makeSingletonDomain(table, column, defaultValue) {
        async function load() {
            if (!state.user) return { data: defaultValue, error: null };
            const { data, error } = await kerphSupabase.from(table)
                .select(column).eq('user_id', state.user.id).maybeSingle();
            return { data: data ? data[column] : defaultValue, error };
        }
        async function save(value) {
            if (!state.user) return { error: { message: 'Not signed in.' } };
            const { error } = await kerphSupabase.from(table)
                .upsert({ user_id: state.user.id, [column]: value, updated_at: new Date().toISOString() });
            return { error };
        }
        return { load, save };
    }

    const currentLayoutDomain = makeSingletonDomain('current_layouts', 'data', null);
    const kerphLoadCurrentLayout = currentLayoutDomain.load;
    const kerphSaveCurrentLayout = currentLayoutDomain.save;

    const toolStatusDomain = makeSingletonDomain('tool_status', 'data', {});
    const kerphLoadToolStatus = toolStatusDomain.load;
    const kerphSaveToolStatus = toolStatusDomain.save;

    const customToolsDomain = makeSingletonDomain('custom_tools', 'data', []);
    const kerphLoadCustomTools = customToolsDomain.load;
    const kerphSaveCustomTools = customToolsDomain.save;

    // One row per suggestion (not a singleton like the domains above) -- admin-only read,
    // reviewed and researched by hand, never auto-published into the catalog.
    async function kerphSuggestTool({ toolName, widthIn, depthIn, heightIn }) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        const { data, error } = await kerphSupabase.from('tool_suggestions').insert({
            user_id: state.user.id,
            tool_name: toolName,
            width_in: widthIn ?? null,
            depth_in: depthIn ?? null,
            height_in: heightIn ?? null
        }).select().maybeSingle();
        return { data, error };
    }

    const cabinetTemplatesDomain = makeSingletonDomain('cabinet_templates', 'data', []);
    const kerphLoadCabinetTemplates = cabinetTemplatesDomain.load;
    const kerphSaveCabinetTemplates = cabinetTemplatesDomain.save;

    const cutlistLivePartsDomain = makeSingletonDomain('cutlist_live_parts', 'data', []);
    const kerphLoadCutListParts = cutlistLivePartsDomain.load;
    const kerphSaveCutListParts = cutlistLivePartsDomain.save;

    // Project Designer's live state is one row, six independently-autosaved columns —
    // one loader, six column-scoped savers so each save touches only its own column.
    const PROJECT_LIVE_DEFAULT = { panels: [], hardware: [], notes: '', labels: [], measurements: [], joints: [] };
    async function kerphLoadProjectLiveState() {
        if (!state.user) return { data: { ...PROJECT_LIVE_DEFAULT }, error: null };
        const { data, error } = await kerphSupabase.from('project_live_state')
            .select('panels, hardware, notes, labels, measurements, joints').eq('user_id', state.user.id).maybeSingle();
        return { data: data || { ...PROJECT_LIVE_DEFAULT }, error };
    }
    function kerphSaveProjectColumn(column) {
        return async (value) => {
            if (!state.user) return { error: { message: 'Not signed in.' } };
            const { error } = await kerphSupabase.from('project_live_state')
                .upsert({ user_id: state.user.id, [column]: value, updated_at: new Date().toISOString() });
            return { error };
        };
    }
    const kerphSaveProjectPanels = kerphSaveProjectColumn('panels');
    const kerphSaveProjectHardware = kerphSaveProjectColumn('hardware');
    const kerphSaveProjectNotes = kerphSaveProjectColumn('notes');
    const kerphSaveProjectLabels3D = kerphSaveProjectColumn('labels');
    const kerphSaveProjectMeasurements3D = kerphSaveProjectColumn('measurements');
    const kerphSaveProjectJoints = kerphSaveProjectColumn('joints');

    /* ---------- Named-save domains: one row per item ---------- */

    function makeNamedSaveDomain(table, rowToItem, itemToRow) {
        async function load() {
            if (!state.user) return { data: [], error: null };
            const { data, error } = await kerphSupabase.from(table)
                .select('*').eq('user_id', state.user.id).order('created_at', { ascending: true });
            if (error) return { data: [], error };
            return { data: data.map(rowToItem), error: null };
        }
        async function insert(item) {
            if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
            const { data, error } = await kerphSupabase.from(table)
                .insert({ user_id: state.user.id, ...itemToRow(item) }).select().single();
            return { data: data ? rowToItem(data) : null, error };
        }
        async function update(id, item) {
            const { data, error } = await kerphSupabase.from(table)
                .update({ ...itemToRow(item), updated_at: new Date().toISOString() })
                .eq('id', id).eq('user_id', state.user.id).select().single();
            return { data: data ? rowToItem(data) : null, error };
        }
        async function del(id) {
            const { error } = await kerphSupabase.from(table).delete().eq('id', id).eq('user_id', state.user.id);
            return { error };
        }
        return { load, insert, update, del };
    }

    function rowToSavedLayout(row) {
        return { ...row.data, id: row.id, name: row.name, layoutType: row.layout_type, savedAt: row.updated_at, shareToken: row.share_token || null };
    }
    const savedLayoutsDomain = makeNamedSaveDomain('saved_layouts', rowToSavedLayout, (layout) => ({
        name: layout.name, layout_type: layout.layoutType || 'workshop', data: layout, share_token: layout.shareToken || null
    }));
    const kerphLoadSavedLayouts = savedLayoutsDomain.load;
    const kerphInsertSavedLayout = savedLayoutsDomain.insert;
    const kerphUpdateSavedLayout = savedLayoutsDomain.update;
    const kerphDeleteSavedLayout = savedLayoutsDomain.del;

    // Shop Showcase "attach a layout" needs a way for OTHER visitors (including signed-out
    // ones) to open one specific saved_layouts row that RLS otherwise restricts to its owner —
    // same security-definer-RPC pattern as kerphGetProjectByShareToken below.
    async function kerphGetLayoutByShareToken(token) {
        const { data, error } = await kerphSupabase.rpc('get_layout_by_share_token', { p_token: token });
        if (error) return { data: null, error };
        const row = Array.isArray(data) ? data[0] : data;
        return { data: row ? { ...row.data, id: row.id, name: row.name, layoutType: row.layout_type } : null, error: null };
    }

    function rowToSavedProject(row) {
        return { ...row.data, id: row.id, name: row.name, savedAt: row.updated_at, shareToken: row.share_token || null };
    }
    const savedProjectsDomain = makeNamedSaveDomain('saved_projects', rowToSavedProject, (project) => ({
        name: project.name, data: project, share_token: project.shareToken || null
    }));
    const kerphLoadSavedProjects = savedProjectsDomain.load;
    const kerphInsertSavedProject = savedProjectsDomain.insert;
    const kerphUpdateSavedProject = savedProjectsDomain.update;
    const kerphDeleteSavedProject = savedProjectsDomain.del;

    // Client-facing read-only 3D view (project-view.html) has no sign-in — same reasoning and
    // same security-definer-RPC pattern as get_quote_by_share_token below: the function bypasses
    // RLS but only ever returns the single row matching an exact, unguessable token.
    async function kerphGetProjectByShareToken(token) {
        const { data, error } = await kerphSupabase.rpc('get_project_by_share_token', { p_token: token });
        if (error) return { data: null, error };
        const row = Array.isArray(data) ? data[0] : data;
        return { data: row ? { ...row.data, id: row.id, name: row.name } : null, error: null };
    }

    // Thumbnail is already a rendered canvas capture (see captureTechnicalDrawingImages-style
    // helpers in project-designer.html), not a user-picked File, so this skips the
    // FileReader/Image downscale round-trip kerphDownscaleImageToBlob does and just uploads the
    // blob directly.
    async function kerphUploadProjectThumbnail(blob) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const path = `${state.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await kerphSupabase.storage.from('project-thumbnails').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) return { data: null, error };
        return { data: { path }, error: null };
    }
    function kerphProjectThumbnailUrl(path) {
        if (!path) return null;
        return kerphSupabase.storage.from('project-thumbnails').getPublicUrl(path).data.publicUrl;
    }

    function rowToQuote(row) {
        return { ...row.data, id: row.id, name: row.name, savedAt: row.updated_at };
    }
    const quotesDomain = makeNamedSaveDomain('quotes', rowToQuote, (quote) => ({
        name: quote.name, data: quote
    }));
    const kerphLoadQuotes = quotesDomain.load;
    const kerphInsertQuote = quotesDomain.insert;
    const kerphUpdateQuote = quotesDomain.update;
    const kerphDeleteQuote = quotesDomain.del;

    // Client-facing quote portal (quote-view.html) has no sign-in — a client shouldn't
    // need a Kerph account just to look at a quote they were sent. Instead of opening the
    // quotes table to public reads (which would leak every user's quotes to any anon
    // query), both of these call security-definer Postgres functions that only ever
    // touch the single row matching the random, unguessable share token — see the SQL
    // delivered to the user (get_quote_by_share_token / respond_to_quote).
    async function kerphGetQuoteByShareToken(token) {
        const { data, error } = await kerphSupabase.rpc('get_quote_by_share_token', { p_token: token });
        if (error) return { data: null, error };
        const row = Array.isArray(data) ? data[0] : data;
        return { data: row ? { ...row.data, id: row.id, name: row.name } : null, error: null };
    }
    async function kerphRespondToQuote(token, response, notes) {
        const { error } = await kerphSupabase.rpc('respond_to_quote', { p_token: token, p_response: response, p_notes: notes || '' });
        return { error };
    }

    // Single extension point for "auto-post this to social media" — insert one row here from
    // wherever content gets published (Garage Tips, Portfolio, and any future content type),
    // and a Database Webhook + Edge Function (post-to-social) take it from there. Callers
    // should only call this on the transition into published/public, not on every re-save.
    async function kerphQueueSocialPost({ source, sourceId, title, excerpt, url, imageUrl }) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        return kerphSupabase.from('social_posts')
            .insert({ user_id: state.user.id, source, source_id: sourceId, title, excerpt, url, image_url: imageUrl || null });
    }

    /* ---------- Shop Showcase: real multi-user content + Storage-backed photos ---------- */

    // Same downscale logic as kerphDownscaleImage but resolves a Blob (for direct Storage
    // upload) instead of a data URL — showcase photos are real viewable images (1200px),
    // not the 200px avatar thumbnail, so they get their own function rather than a shared
    // one with a confusing dual purpose.
    function kerphDownscaleImageToBlob(file, maxDim, quality) {
        maxDim = maxDim || 1200;
        quality = quality || 0.85;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    let { width, height } = img;
                    if (width > height && width > maxDim) {
                        height = Math.round(height * maxDim / width);
                        width = maxDim;
                    } else if (height > maxDim) {
                        width = Math.round(width * maxDim / height);
                        height = maxDim;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function kerphUploadShowcasePhoto(file) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const blob = await kerphDownscaleImageToBlob(file, 1200, 0.85);
        const path = `${state.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await kerphSupabase.storage.from('showcase-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) return { data: null, error };
        return { data: { path }, error: null };
    }

    function kerphShowcaseImageUrl(path) {
        if (!path) return null;
        return kerphSupabase.storage.from('showcase-photos').getPublicUrl(path).data.publicUrl;
    }

    // Videos go into the same public showcase-photos bucket (its storage policies key off
    // bucket + owner folder, not content-type) but skip the canvas-based downscale pipeline
    // that only works on images.
    async function kerphUploadShowcaseVideo(file) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
        const path = `${state.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await kerphSupabase.storage.from('showcase-photos').upload(path, file, { contentType: file.type || 'video/mp4' });
        if (error) return { data: null, error };
        return { data: { path }, error: null };
    }

    async function kerphLoadShowcasePosts() {
        const { data, error } = await kerphSupabase.from('showcase_posts')
            .select('*, showcase_comments(*)').order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    async function kerphCreateShowcasePost({ title, description, imagePath, galleryPaths, videoPath, layoutId, layoutShareToken, layoutName, tags, author }) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        return kerphSupabase.from('showcase_posts')
            .insert({
                user_id: state.user.id, title, description, image_path: imagePath,
                gallery_paths: galleryPaths || [], video_path: videoPath || null,
                layout_id: layoutId || null, layout_share_token: layoutShareToken || null, layout_name: layoutName || null,
                tags, author
            })
            .select().single();
    }

    async function kerphDeleteShowcasePost(id, imagePath, galleryPaths, videoPath) {
        const paths = [imagePath, ...(galleryPaths || []), videoPath].filter(Boolean);
        if (paths.length) await kerphSupabase.storage.from('showcase-photos').remove(paths);
        const { error } = await kerphSupabase.from('showcase_posts').delete().eq('id', id).eq('user_id', state.user.id);
        return { error };
    }

    async function kerphAddShowcaseComment(postId, body) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const author = (kerphGetCachedProfile().username || '').trim() || 'Anonymous';
        return kerphSupabase.from('showcase_comments').insert({ post_id: postId, user_id: state.user.id, author, body }).select().single();
    }

    async function kerphLoadMyShowcaseLikes() {
        if (!state.user) return { data: [], error: null };
        const { data, error } = await kerphSupabase.from('showcase_likes').select('post_id').eq('user_id', state.user.id);
        return { data: (data || []).map((r) => r.post_id), error };
    }

    async function kerphToggleShowcaseLike(postId, currentlyLiked) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        if (currentlyLiked) {
            const { error } = await kerphSupabase.from('showcase_likes').delete().eq('post_id', postId).eq('user_id', state.user.id);
            return { error };
        }
        const { error } = await kerphSupabase.from('showcase_likes').insert({ post_id: postId, user_id: state.user.id });
        return { error };
    }

    // Garage Tips & How-To's — admin-authored articles (RLS enforces the write restriction
    // server-side; kerphIsAdmin() above is only for deciding what UI to show, not security).
    async function kerphLoadGarageTips() {
        const { data, error } = await kerphSupabase.from('garage_tips').select('*').order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    async function kerphInsertGarageTip({ title, excerpt, bodyHtml, coverImagePath, videoUrl, category, tags, published, author }) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        return kerphSupabase.from('garage_tips')
            .insert({
                user_id: state.user.id, title, excerpt, body_html: bodyHtml, cover_image_path: coverImagePath,
                video_url: videoUrl, category, tags, published, author
            })
            .select().single();
    }

    async function kerphUpdateGarageTip(id, { title, excerpt, bodyHtml, coverImagePath, videoUrl, category, tags, published }) {
        return kerphSupabase.from('garage_tips')
            .update({
                title, excerpt, body_html: bodyHtml, cover_image_path: coverImagePath, video_url: videoUrl,
                category, tags, published, updated_at: new Date().toISOString()
            })
            .eq('id', id).select().single();
    }

    async function kerphDeleteGarageTip(id, coverImagePath) {
        if (coverImagePath) await kerphSupabase.storage.from('garage-tips-images').remove([coverImagePath]);
        const { error } = await kerphSupabase.from('garage_tips').delete().eq('id', id);
        return { error };
    }

    async function kerphUploadGarageTipImage(file) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const blob = await kerphDownscaleImageToBlob(file, 1200, 0.85);
        const path = `${state.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await kerphSupabase.storage.from('garage-tips-images').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) return { data: null, error };
        return { data: { path }, error: null };
    }

    function kerphGarageTipImageUrl(path) {
        if (!path) return null;
        // Static site-bundled cover art (images/garage-tips/...) or a full URL is served as-is;
        // everything else is a real Storage object path uploaded via the article editor.
        if (/^(https?:)?\/\//i.test(path) || path.startsWith('images/')) return path;
        return kerphSupabase.storage.from('garage-tips-images').getPublicUrl(path).data.publicUrl;
    }

    /* ---------- Portfolio: permanent per-project pages, tied into Shop Showcase ---------- */

    async function kerphUploadPortfolioPhoto(file) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const blob = await kerphDownscaleImageToBlob(file, 1200, 0.85);
        const path = `${state.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await kerphSupabase.storage.from('portfolio-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) return { data: null, error };
        return { data: { path }, error: null };
    }

    function kerphPortfolioImageUrl(path) {
        if (!path) return null;
        return kerphSupabase.storage.from('portfolio-photos').getPublicUrl(path).data.publicUrl;
    }

    // Own projects (any visibility) — for the "manage my portfolio" view.
    async function kerphLoadMyPortfolioProjects() {
        if (!state.user) return { data: [], error: null };
        const { data, error } = await kerphSupabase.from('portfolio_projects')
            .select('*').eq('user_id', state.user.id).order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    // Another user's PUBLIC projects only — RLS also enforces this server-side, this
    // client-side filter just avoids ever asking for private rows in the first place.
    async function kerphLoadPublicPortfolio(userId) {
        const { data, error } = await kerphSupabase.from('portfolio_projects')
            .select('*').eq('user_id', userId).eq('is_public', true).order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    async function kerphCreatePortfolioProject(project) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        return kerphSupabase.from('portfolio_projects').insert({
            user_id: state.user.id,
            title: project.title, description: project.description || null,
            materials: project.materials || null, finish: project.finish || null,
            plan_source: project.planSource || null,
            cover_path: project.coverPath || null, gallery_paths: project.galleryPaths || [],
            is_public: project.isPublic !== false
        }).select().single();
    }

    async function kerphUpdatePortfolioProject(id, project) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        return kerphSupabase.from('portfolio_projects').update({
            title: project.title, description: project.description || null,
            materials: project.materials || null, finish: project.finish || null,
            plan_source: project.planSource || null,
            cover_path: project.coverPath || null, gallery_paths: project.galleryPaths || [],
            is_public: project.isPublic !== false,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('user_id', state.user.id).select().single();
    }

    async function kerphDeletePortfolioProject(id, photoPaths) {
        if (photoPaths && photoPaths.length) await kerphSupabase.storage.from('portfolio-photos').remove(photoPaths);
        const { error } = await kerphSupabase.from('portfolio_projects').delete().eq('id', id).eq('user_id', state.user.id);
        return { error };
    }

    /* ---------- 3D-Print Plans Library: shared, searchable printable jigs/fixtures ---------- */

    async function kerphUploadPrintPlanFile(file) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${state.user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}_${safeName}`;
        const { error } = await kerphSupabase.storage.from('print-plans').upload(path, file);
        if (error) return { data: null, error };
        return { data: { path, fileName: file.name }, error: null };
    }

    function kerphPrintPlanFileUrl(path) {
        if (!path) return null;
        return kerphSupabase.storage.from('print-plans').getPublicUrl(path).data.publicUrl;
    }

    async function kerphLoadPrintPlans() {
        const { data, error } = await kerphSupabase.from('print_plans').select('*').order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    async function kerphCreatePrintPlan({ title, description, category, license, sourceUrl, filePath, fileName }) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        const author = (kerphGetCachedProfile().username || '').trim() || 'Anonymous';
        return kerphSupabase.from('print_plans').insert({
            user_id: state.user.id, title, description: description || null,
            category, license, source_url: sourceUrl || null,
            file_path: filePath || null, file_name: fileName || null, author
        }).select().single();
    }

    async function kerphDeletePrintPlan(id, filePath) {
        if (filePath) await kerphSupabase.storage.from('print-plans').remove([filePath]);
        const { error } = await kerphSupabase.from('print_plans').delete().eq('id', id).eq('user_id', state.user.id);
        return { error };
    }

    async function kerphIncrementPrintPlanDownloads(id) {
        const { error } = await kerphSupabase.rpc('increment_print_plan_downloads', { plan_id: id });
        return { error };
    }

    /* ---------- Tool Reviews: real multi-user content, same shape as Showcase likes ---------- */

    async function kerphLoadToolReviews() {
        const { data, error } = await kerphSupabase.from('tool_reviews').select('*').order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    async function kerphCreateToolReview({ toolName, category, rating, text, author }) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        return kerphSupabase.from('tool_reviews')
            .insert({ user_id: state.user.id, tool_name: toolName, category, rating, review_text: text, author })
            .select().single();
    }

    async function kerphLoadMyReviewVotes() {
        if (!state.user) return { data: [], error: null };
        const { data, error } = await kerphSupabase.from('tool_review_votes').select('review_id').eq('user_id', state.user.id);
        return { data: (data || []).map((r) => r.review_id), error };
    }

    async function kerphToggleReviewHelpful(reviewId, currentlyVoted) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        if (currentlyVoted) {
            const { error } = await kerphSupabase.from('tool_review_votes').delete().eq('review_id', reviewId).eq('user_id', state.user.id);
            return { error };
        }
        const { error } = await kerphSupabase.from('tool_review_votes').insert({ review_id: reviewId, user_id: state.user.id });
        return { error };
    }

    /* ---------- One-time migration of pre-existing localStorage data into the DB ----------
       Runs automatically, once per user per browser, on the first onAuthStateChange after a
       real sign-in. Guarded by a per-user sentinel (perf short-circuit on every later load)
       PLUS a "is the DB actually empty for this domain" check as the real correctness guard —
       so a second browser/device signed into the same account never clobbers real data with
       stale local values just because it hasn't run migration before. Best-effort throughout:
       any single domain failing must not block sign-in. */

    async function kerphRunLocalMigration() {
        const userId = state.user.id;
        const sentinel = 'kerphLocalMigrationDone_' + userId;
        if (localStorage.getItem(sentinel)) return;
        // Claim the sentinel synchronously, before any await, not after migration finishes.
        // Verified live: the whole migration takes several sequential network round-trips, so
        // a second kerphRunLocalMigration() call (from any source — a duplicate auth event, a
        // second script instance, whatever) landing anywhere in that window would find the
        // sentinel still unset and re-run migrateCollection()'s non-idempotent inserts,
        // producing duplicate saved_layouts/saved_projects rows. Setting it here closes that
        // whole window instead of just the moment right before the callback that invokes this.
        localStorage.setItem(sentinel, 'true');

        async function migrateSingleton(localKey, loadFn, saveFn, isEmptyLocal) {
            try {
                const raw = localStorage.getItem(localKey);
                if (!raw) return;
                const local = JSON.parse(raw);
                if (isEmptyLocal(local)) return;
                const { data: remote } = await loadFn();
                const remoteEmpty = remote == null || (Array.isArray(remote) ? remote.length === 0 :
                    (typeof remote === 'object' && Object.keys(remote).length === 0));
                if (!remoteEmpty) return;
                await saveFn(local);
            } catch (e) { /* best-effort */ }
        }
        async function migrateCollection(localKey, loadFn, insertFn) {
            try {
                const raw = localStorage.getItem(localKey);
                if (!raw) return;
                const local = JSON.parse(raw);
                if (!Array.isArray(local) || !local.length) return;
                const { data: remote } = await loadFn();
                if (remote && remote.length) return;
                for (const item of local) { await insertFn(item); }
            } catch (e) { /* best-effort */ }
        }

        await migrateSingleton('kerphCurrentLayout', kerphLoadCurrentLayout, kerphSaveCurrentLayout, (v) => !v);
        await migrateSingleton('kerphToolStatus', kerphLoadToolStatus, kerphSaveToolStatus, (v) => !v || !Object.keys(v).length);
        await migrateSingleton('kerphCustomTools', kerphLoadCustomTools, kerphSaveCustomTools, (v) => !v || !v.length);
        await migrateSingleton('kerphCabinetTemplates', kerphLoadCabinetTemplates, kerphSaveCabinetTemplates, (v) => !v || !v.length);
        await migrateSingleton('kerphCutListParts', kerphLoadCutListParts, kerphSaveCutListParts, (v) => !v || !v.length);
        await migrateCollection('kerphSavedLayouts', kerphLoadSavedLayouts, kerphInsertSavedLayout);
        await migrateCollection('kerphSavedProjects', kerphLoadSavedProjects, kerphInsertSavedProject);

        try {
            const panels = JSON.parse(localStorage.getItem('kerphProjectPanels') || '[]');
            const hardware = JSON.parse(localStorage.getItem('kerphProjectHardware') || '[]');
            const notes = localStorage.getItem('kerphProjectNotes') || '';
            const labels = JSON.parse(localStorage.getItem('kerphProjectLabels3D') || '[]');
            const measurements = JSON.parse(localStorage.getItem('kerphProjectMeasurements3D') || '[]');
            if (panels.length || hardware.length || notes || labels.length || measurements.length) {
                const { data: remote } = await kerphLoadProjectLiveState();
                const remoteEmpty = !remote.panels.length && !remote.hardware.length && !remote.notes && !remote.labels.length && !remote.measurements.length;
                if (remoteEmpty) {
                    await kerphSaveProjectPanels(panels);
                    await kerphSaveProjectHardware(hardware);
                    await kerphSaveProjectNotes(notes);
                    await kerphSaveProjectLabels3D(labels);
                    await kerphSaveProjectMeasurements3D(measurements);
                }
            }
        } catch (e) { /* best-effort */ }

        try {
            const localUnit = localStorage.getItem('kerphUnitSystem');
            const localReminders = localStorage.getItem('kerphMaintenanceRemindersEnabled');
            const needsUnit = localUnit && state.profile && state.profile.unit_system == null;
            const needsReminders = localReminders !== null && state.profile && state.profile.maintenance_reminders_enabled == null;
            if (needsUnit || needsReminders) {
                await kerphSaveProfile({
                    username: state.profile.username,
                    unitSystem: needsUnit ? localUnit : undefined,
                    maintenanceRemindersEnabled: needsReminders ? (localReminders !== 'false') : undefined
                });
            }
        } catch (e) { /* best-effort */ }
    }

    function kerphOnVisible(callback) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') callback();
        });
    }

    /* ---------- TOOL TIER GATING (soft/local — kerphPlan isn't billing-enforced yet) ----------
       Distinct from the sub-feature gating that already lives inside each tool (saved-layout
       caps, watermarks, etc.) — this is a new, separate axis: can the page be opened at all.
       The actual hard block lives in a small inline script at the top of each gated page's
       <head> (same pattern as the existing Coming Soon bypass check) since it has to run
       synchronously before this file even loads. What lives here is the *visible* half —
       graying out the nav dropdown and home-page tiles — so the restriction is obvious
       before a locked page is ever clicked, not just discovered via a redirect. */
    const KERPH_PLAN_RANK = { free: 0, pro: 1, premier: 2 };
    const KERPH_TOOL_TIER_MAP = {
        'project-designer.html': 'pro',
        'shop-3d-viewer.html': 'pro',
        'quote-builder.html': 'premier',
        'portfolio.html': 'pro',
        'shop-jigs-part-finder.html': 'pro'
    };
    const KERPH_TIER_LABELS = { pro: 'Pro', premier: 'Premier' };

    function kerphPlanMeetsTier(plan, requiredTier) {
        return (KERPH_PLAN_RANK[plan] || 0) >= (KERPH_PLAN_RANK[requiredTier] || 0);
    }

    function kerphRequiredTierFor(page) {
        return KERPH_TOOL_TIER_MAP[page] || null;
    }

    // Grays out + disables any pageNavSelect <option> whose page isn't included in the
    // current plan, tagging its label with a lock icon + tier name. Self-running (no
    // per-page wiring) so every page's copy of the dropdown picks this up automatically —
    // also re-run on any known plan-switching control (pricing.html's preview buttons, the
    // account modal's plan select, the legacy header plan select) via event delegation, so
    // it reflects a plan change made without leaving the page.
    function kerphApplyNavTierLocks() {
        const select = document.getElementById('pageNavSelect');
        if (!select) return;
        const plan = kerphGetCachedEffectivePlan();
        const options = Array.from(select.options);
        options.forEach((opt) => {
            const tier = KERPH_TOOL_TIER_MAP[opt.value];
            if (!tier) return;
            const baseText = opt.textContent.replace(/^\u{1F512} /u, '').replace(/ — (Pro|Premier)$/, '');
            if (kerphPlanMeetsTier(plan, tier)) {
                opt.disabled = false;
                opt.textContent = baseText;
            } else {
                opt.disabled = true;
                opt.textContent = `\u{1F512} ${baseText} — ${KERPH_TIER_LABELS[tier]}`;
            }
        });
        // Locked options sink to the bottom (stable within each group) so a Free-plan user
        // isn't scanning past several disabled entries before reaching what they can open.
        const selectedValue = select.value;
        const unlocked = options.filter((o) => !o.disabled);
        const locked = options.filter((o) => o.disabled);
        unlocked.concat(locked).forEach((o) => select.appendChild(o));
        select.value = selectedValue;
    }

    // Dims + badges any home-page tool-card tile whose href is a gated page the current
    // plan doesn't reach. Doesn't intercept the click — the tile stays a real link, and
    // the gated page's own top-of-head redirect (see above) is what actually stops it;
    // this just sets the right expectation before the click happens.
    function kerphApplyToolCardTierLocks() {
        const cards = document.querySelectorAll('.tool-card[href]');
        if (!cards.length) return;
        const plan = kerphGetCachedEffectivePlan();
        cards.forEach((card) => {
            const tier = KERPH_TOOL_TIER_MAP[card.getAttribute('href')];
            if (!tier) return;
            let badge = card.querySelector('.tool-card-tier-badge');
            if (kerphPlanMeetsTier(plan, tier)) {
                card.classList.remove('tool-card-locked');
                if (badge) badge.remove();
                return;
            }
            card.classList.add('tool-card-locked');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tool-card-tier-badge';
                card.appendChild(badge);
            }
            badge.textContent = `\u{1F512} ${KERPH_TIER_LABELS[tier]}`;
        });
    }

    function kerphRefreshTierLocks() {
        kerphApplyNavTierLocks();
        kerphApplyToolCardTierLocks();
    }

    // The actual fix for "a browser toggle grants paid access": every page's local getPlan()
    // (previously a bare localStorage read, copy-pasted into ~26 files) now delegates here.
    // Signed OUT, the localStorage preview toggle is still the whole story — there's no
    // subscription to check, and pricing.html's "Preview" buttons are explicitly meant to let
    // someone browse a tier's UI before creating an account. Signed IN, the real subscription
    // (cachedEffectivePlan, refreshed on every auth event above) governs and the local toggle
    // is ignored outright, so a signed-in Free user can no longer grant themselves Pro/Premier
    // by editing a browser value.
    function kerphGetCachedEffectivePlan() {
        // Admins (profiles.is_admin, e.g. the site owner's own account) keep the old
        // toggle-driven preview behavior even while signed in — they need to see every
        // tier's UI without buying a real subscription on their own account. Every other
        // signed-in user is locked to their real plan; this is the one deliberate exception.
        if (state.user && state.profile && state.profile.is_admin) {
            return localStorage.getItem('kerphPlan') || 'free';
        }
        return state.user ? cachedEffectivePlan.plan : (localStorage.getItem('kerphPlan') || 'free');
    }

    // Second-pass gate for the 5 tier-gated pages (project-designer.html, shop-3d-viewer.html,
    // quote-builder.html, portfolio.html, shop-jigs-part-finder.html). Each of those pages
    // still has its own synchronous, localStorage-only redirect at the very top of <head> — has
    // to stay, since it runs before this file even loads — which is a fast first pass with zero
    // flash for the common case. This is what actually closes the loophole: called once
    // kerphAuthReady resolves, it re-checks against the REAL subscription and kicks a signed-in
    // user back out if their real plan doesn't cover the page, regardless of what got them past
    // the first-pass check (a spoofed localStorage value, most likely). Signed-out visitors are
    // exempt — nothing to verify against, and that's the intended anonymous-preview path.
    async function kerphEnforceRealTierGate() {
        if (!state.user) return;
        if (state.profile && state.profile.is_admin) return; // admins preview via the local toggle instead
        const page = location.pathname.split('/').pop();
        const requiredTier = kerphRequiredTierFor(page);
        if (!requiredTier) return;
        if (!kerphPlanMeetsTier(cachedEffectivePlan.plan, requiredTier)) {
            location.replace(`pricing.html?locked=${page}`);
        }
    }

    document.addEventListener('DOMContentLoaded', kerphRefreshTierLocks);
    // Same-tab plan changes don't fire the 'storage' event (that's cross-tab only), so this
    // delegated listener is what catches pricing.html's preview buttons, the account modal's
    // plan select, and the legacy header plan select without needing each page wired up
    // individually. setTimeout defers to after the click/change handler's own localStorage
    // write actually lands.
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-tier-btn]')) setTimeout(kerphRefreshTierLocks, 0);
    });
    document.addEventListener('change', (e) => {
        if (e.target.id === 'accountPlanSelect' || e.target.id === 'planSelector') setTimeout(kerphRefreshTierLocks, 0);
    });

    // ---------- Real Lemon Squeezy subscription status ----------
    // Nothing calls this yet — the plan/tier gating above is still the local-preview
    // mechanism everywhere it's actually wired up. This exists so the moment real
    // checkout is live, swapping the preview toggle for the real thing is a small,
    // localized change instead of a from-scratch build. See sql/lemon-squeezy-
    // subscriptions.sql and supabase/functions/lemon-squeezy-webhook for the rest of
    // the pipeline this feeds from.
    //
    // Deliberately fails safe to 'free' on ANY error — not signed in, the
    // subscriptions table/view not existing yet (pre-migration), a network hiccup,
    // no row for this user (never subscribed) — rather than distinguishing those
    // cases, since every one of them means the same thing here: this browser has no
    // basis to claim paid access.
    async function kerphGetMySubscription() {
        const fallback = { plan: 'free', status: 'active', renewsAt: null, endsAt: null, customerPortalUrl: null };
        if (!state.user) return { data: fallback, error: null };
        const { data, error } = await kerphSupabase
            .from('my_current_subscription')
            .select('plan, status, renews_at, ends_at, customer_portal_url')
            .eq('user_id', state.user.id)
            .maybeSingle();
        if (error || !data) return { data: fallback, error: null };
        // Only these statuses count as currently entitled — cancelled/expired/unpaid/
        // paused all report the real plan name (useful for "you were Premier" messaging
        // later) but WITH status carried through, so callers that only check .plan
        // without also checking .status would get this wrong — kerphPlanMeetsTier
        // callers should gate on the pre-computed .plan below, not re-derive it.
        const entitled = data.status === 'active' || data.status === 'on_trial' || data.status === 'past_due';
        return {
            data: {
                plan: entitled ? data.plan : 'free',
                status: data.status,
                renewsAt: data.renews_at,
                endsAt: data.ends_at,
                customerPortalUrl: data.customer_portal_url || null
            },
            error: null
        };
    }
    window.kerphGetMySubscription = kerphGetMySubscription;

    // ---------- Teams (Pro/Premier seat management) ----------
    // A Pro or Premier subscriber can invite teammates for free up to their plan's included
    // seat count (2 total seats on Pro, 4 total on Premier, owner included); each seat beyond
    // that is $7/mo, synced to Lemon Squeezy's "Extra Seats" variant by the sync-team-seats
    // Edge Function. See sql/teams.sql for the schema and RLS — Postgres, not this file, is
    // what actually stops a non-Pro/Premier user from inviting anyone, the same "browser can't
    // self-grant" principle as kerphGetMySubscription.
    const TEAM_INCLUDED_SEATS = 4;
    const TEAM_EXTRA_SEAT_PRICE = 7;
    function kerphTeamIncludedSeatsForPlan(plan) {
        return plan === 'premier' ? 4 : 2;
    }

    async function kerphGetMyTeam() {
        const fallback = { team: null, members: [], isOwner: false, includedSeats: TEAM_INCLUDED_SEATS, extraSeatPrice: TEAM_EXTRA_SEAT_PRICE };
        if (!state.user) return { data: fallback, error: null };
        const { data: ownedTeam } = await kerphSupabase.from('teams').select('*').eq('owner_id', state.user.id).maybeSingle();
        if (ownedTeam) {
            const { data: members } = await kerphSupabase.from('team_members').select('*').eq('team_id', ownedTeam.id).order('invited_at', { ascending: true });
            const { data: ownerSub } = await kerphGetMySubscription();
            const includedSeats = kerphTeamIncludedSeatsForPlan(ownerSub && ownerSub.plan);
            return { data: { team: ownedTeam, members: members || [], isOwner: true, includedSeats, extraSeatPrice: TEAM_EXTRA_SEAT_PRICE }, error: null };
        }
        // Not an owner — maybe an accepted member of someone else's team.
        const { data: membership } = await kerphSupabase.from('team_members').select('*, teams(*)').eq('user_id', state.user.id).eq('status', 'active').maybeSingle();
        if (membership && membership.teams) {
            return { data: { team: membership.teams, members: [], isOwner: false, includedSeats: TEAM_INCLUDED_SEATS, extraSeatPrice: TEAM_EXTRA_SEAT_PRICE }, error: null };
        }
        return { data: fallback, error: null };
    }

    async function kerphInviteTeamMember(email) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail) return { error: { message: 'Enter an email address to invite.' } };
        const { data: team, error: teamError } = await kerphSupabase
            .from('teams').upsert({ owner_id: state.user.id }, { onConflict: 'owner_id' }).select().single();
        if (teamError) return { error: teamError };
        const { data, error } = await kerphSupabase
            .from('team_members')
            .insert({ team_id: team.id, invited_email: normalizedEmail })
            .select().single();
        let sync = null;
        if (!error) sync = await kerphSyncTeamSeats();
        return { data, error, sync: sync ? sync.data : null };
    }

    async function kerphRemoveTeamMember(memberId) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        const { error } = await kerphSupabase.from('team_members').delete().eq('id', memberId);
        let sync = null;
        if (!error) sync = await kerphSyncTeamSeats();
        return { error, sync: sync ? sync.data : null };
    }

    async function kerphLeaveTeam(memberId) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        const { error } = await kerphSupabase.from('team_members').delete().eq('id', memberId).eq('user_id', state.user.id);
        return { error };
    }

    async function kerphCallEdgeFunction(name, body) {
        const { data: { session } } = await kerphSupabase.auth.getSession();
        if (!session) return { error: { message: 'Not signed in.' } };
        try {
            const resp = await fetch(`${kerphSupabase.supabaseUrl}/functions/v1/${name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify(body || {})
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok) return { error: { message: result.error || `${name} failed.` } };
            return { data: result, error: null };
        } catch (e) {
            return { error: { message: e.message || `${name} failed.` } };
        }
    }

    async function kerphAcceptTeamInvite(token) {
        return kerphCallEdgeFunction('accept-team-invite', { token });
    }

    async function kerphSyncTeamSeats() {
        return kerphCallEdgeFunction('sync-team-seats', {});
    }

    // The real (not localStorage-preview) effective plan for this user: their own direct
    // subscription, or — if that's free/none — the plan tier (Pro or Premier) inherited from
    // an active team membership. Wired into cachedEffectivePlan on every auth event above, so
    // this drives real page-gating — it must reflect the owner's ACTUAL plan, not assume
    // Premier, now that Pro teams exist too. RLS can't let a member read the owner's
    // subscription row directly, so kerph_team_owner_plan() (sql/teams.sql) does that lookup
    // narrowly server-side.
    async function kerphGetMyEffectivePlan() {
        const direct = await kerphGetMySubscription();
        if (direct.data.plan !== 'free' || !state.user) return direct;
        const { data: membership } = await kerphSupabase
            .from('team_members').select('status, team_id').eq('user_id', state.user.id).eq('status', 'active').maybeSingle();
        if (membership) {
            const { data: ownerPlan } = await kerphSupabase.rpc('kerph_team_owner_plan', { p_team_id: membership.team_id });
            return { data: { ...direct.data, plan: ownerPlan || 'free', viaTeam: !!ownerPlan }, error: null };
        }
        return direct;
    }

    // ---------- Part Finder (Pro/Premier, tiered daily cap) ----------
    // Sends a photo to the identify-part Edge Function (which calls Claude's vision API
    // server-side — the API key never touches the browser) and returns the identification
    // plus generated retailer search links. Real per-photo cost, so this is Pro+-gated with
    // a per-tier daily cap enforced server-side; see supabase/functions/identify-part.
    async function kerphIdentifyPart(imageBase64, mediaType) {
        const { data: { session } } = await kerphSupabase.auth.getSession();
        if (!session) return { error: { message: 'Not signed in.' } };
        try {
            const resp = await fetch(`${kerphSupabase.supabaseUrl}/functions/v1/identify-part`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ imageBase64, mediaType })
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok || result.error) return { error: { message: result.error || 'Could not identify that part.' } };
            return { data: result, error: null };
        } catch (e) {
            return { error: { message: e.message || 'Could not identify that part.' } };
        }
    }

    async function kerphGetMyPartLookupHistory() {
        if (!state.user) return { data: [], error: null };
        const { data, error } = await kerphSupabase
            .from('part_lookups').select('*').eq('user_id', state.user.id)
            .order('created_at', { ascending: false }).limit(20);
        return { data: data || [], error };
    }

    // ---------- Project Designer: "Import from Photo" (Premier) ----------
    // Sends a photo of a cabinet/bookcase/furniture piece to the identify-furniture Edge
    // Function (Claude vision, server-side — the API key never touches the browser) and
    // returns a rough starting build spec (estimated dimensions, shelf/door/drawer counts,
    // construction style, material guess, confidence, caveats) for Project Designer to turn
    // into starter panels. Real per-photo cost, so this is Premier-gated; see
    // supabase/functions/identify-furniture. referenceMeasurementIn/referenceDescription are
    // optional — e.g. {referenceMeasurementIn: 30, referenceDescription: 'overall width'} —
    // and meaningfully improve estimate accuracy when supplied, since a single photo has no
    // real-world scale reference on its own.
    async function kerphIdentifyFurniture(imageBase64, mediaType, referenceMeasurementIn, referenceDescription) {
        const { data: { session } } = await kerphSupabase.auth.getSession();
        if (!session) return { error: { message: 'Not signed in.' } };
        try {
            const resp = await fetch(`${kerphSupabase.supabaseUrl}/functions/v1/identify-furniture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ imageBase64, mediaType, referenceMeasurementIn, referenceDescription })
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok || result.error) return { error: { message: result.error || 'Could not analyze that photo.' } };
            return { data: result, error: null };
        } catch (e) {
            return { error: { message: e.message || 'Could not analyze that photo.' } };
        }
    }

    async function kerphGetMyFurnitureLookupHistory() {
        if (!state.user) return { data: [], error: null };
        const { data, error } = await kerphSupabase
            .from('furniture_lookups').select('*').eq('user_id', state.user.id)
            .order('created_at', { ascending: false }).limit(20);
        return { data: data || [], error };
    }

    window.kerphIdentifyPart = kerphIdentifyPart;
    window.kerphGetMyPartLookupHistory = kerphGetMyPartLookupHistory;
    window.kerphIdentifyFurniture = kerphIdentifyFurniture;
    window.kerphGetMyFurnitureLookupHistory = kerphGetMyFurnitureLookupHistory;

    window.kerphGetMyTeam = kerphGetMyTeam;
    window.kerphInviteTeamMember = kerphInviteTeamMember;
    window.kerphRemoveTeamMember = kerphRemoveTeamMember;
    window.kerphLeaveTeam = kerphLeaveTeam;
    window.kerphAcceptTeamInvite = kerphAcceptTeamInvite;
    window.kerphSyncTeamSeats = kerphSyncTeamSeats;
    window.kerphGetMyEffectivePlan = kerphGetMyEffectivePlan;
    window.TEAM_INCLUDED_SEATS = TEAM_INCLUDED_SEATS;
    window.TEAM_EXTRA_SEAT_PRICE = TEAM_EXTRA_SEAT_PRICE;

    window.kerphPlanMeetsTier = kerphPlanMeetsTier;
    window.kerphRequiredTierFor = kerphRequiredTierFor;
    window.kerphRefreshTierLocks = kerphRefreshTierLocks;
    window.kerphGetCachedEffectivePlan = kerphGetCachedEffectivePlan;
    window.kerphEnforceRealTierGate = kerphEnforceRealTierGate;

    window.kerphSupabase = kerphSupabase;
    window.kerphAuthReady = kerphAuthReady;
    window.kerphSignUp = kerphSignUp;
    window.kerphSignIn = kerphSignIn;
    window.kerphSignOut = kerphSignOut;
    window.kerphRequestPasswordReset = kerphRequestPasswordReset;
    window.kerphUpdatePassword = kerphUpdatePassword;
    window.kerphGetCachedUser = kerphGetCachedUser;
    window.kerphGetCachedProfile = kerphGetCachedProfile;
    window.kerphSaveProfile = kerphSaveProfile;
    window.kerphOnAuthChange = kerphOnAuthChange;
    window.kerphDownscaleImage = kerphDownscaleImage;
    window.kerphShowSubscribePrompt = kerphShowSubscribePrompt;
    window.kerphShowSignUpModal = kerphShowSignUpModal;
    window.kerphShowContactModal = kerphShowContactModal;
    window.kerphSyncAdminDashboardLink = kerphSyncAdminDashboardLink;
    window.kerphOnVisible = kerphOnVisible;

    window.kerphLoadCurrentLayout = kerphLoadCurrentLayout;
    window.kerphSaveCurrentLayout = kerphSaveCurrentLayout;
    window.kerphLoadToolStatus = kerphLoadToolStatus;
    window.kerphSaveToolStatus = kerphSaveToolStatus;
    window.kerphLoadCustomTools = kerphLoadCustomTools;
    window.kerphSaveCustomTools = kerphSaveCustomTools;
    window.kerphSuggestTool = kerphSuggestTool;
    window.kerphLoadCabinetTemplates = kerphLoadCabinetTemplates;
    window.kerphSaveCabinetTemplates = kerphSaveCabinetTemplates;
    window.kerphLoadCutListParts = kerphLoadCutListParts;
    window.kerphSaveCutListParts = kerphSaveCutListParts;

    window.kerphLoadProjectLiveState = kerphLoadProjectLiveState;
    window.kerphSaveProjectPanels = kerphSaveProjectPanels;
    window.kerphSaveProjectHardware = kerphSaveProjectHardware;
    window.kerphSaveProjectNotes = kerphSaveProjectNotes;
    window.kerphSaveProjectLabels3D = kerphSaveProjectLabels3D;
    window.kerphSaveProjectMeasurements3D = kerphSaveProjectMeasurements3D;
    window.kerphSaveProjectJoints = kerphSaveProjectJoints;

    window.kerphLoadSavedLayouts = kerphLoadSavedLayouts;
    window.kerphInsertSavedLayout = kerphInsertSavedLayout;
    window.kerphUpdateSavedLayout = kerphUpdateSavedLayout;
    window.kerphDeleteSavedLayout = kerphDeleteSavedLayout;
    window.kerphGetLayoutByShareToken = kerphGetLayoutByShareToken;
    window.kerphLoadSavedProjects = kerphLoadSavedProjects;
    window.kerphInsertSavedProject = kerphInsertSavedProject;
    window.kerphUpdateSavedProject = kerphUpdateSavedProject;
    window.kerphDeleteSavedProject = kerphDeleteSavedProject;
    window.kerphGetProjectByShareToken = kerphGetProjectByShareToken;
    window.kerphUploadProjectThumbnail = kerphUploadProjectThumbnail;
    window.kerphProjectThumbnailUrl = kerphProjectThumbnailUrl;

    window.kerphLoadQuotes = kerphLoadQuotes;
    window.kerphInsertQuote = kerphInsertQuote;
    window.kerphUpdateQuote = kerphUpdateQuote;
    window.kerphDeleteQuote = kerphDeleteQuote;
    window.kerphGetQuoteByShareToken = kerphGetQuoteByShareToken;
    window.kerphRespondToQuote = kerphRespondToQuote;
    window.kerphQueueSocialPost = kerphQueueSocialPost;

    window.kerphDownscaleImageToBlob = kerphDownscaleImageToBlob;
    window.kerphUploadShowcasePhoto = kerphUploadShowcasePhoto;
    window.kerphUploadShowcaseVideo = kerphUploadShowcaseVideo;
    window.kerphShowcaseImageUrl = kerphShowcaseImageUrl;
    window.kerphLoadShowcasePosts = kerphLoadShowcasePosts;
    window.kerphCreateShowcasePost = kerphCreateShowcasePost;
    window.kerphDeleteShowcasePost = kerphDeleteShowcasePost;
    window.kerphAddShowcaseComment = kerphAddShowcaseComment;
    window.kerphLoadMyShowcaseLikes = kerphLoadMyShowcaseLikes;
    window.kerphToggleShowcaseLike = kerphToggleShowcaseLike;

    window.kerphIsAdmin = kerphIsAdmin;
    window.kerphLoadGarageTips = kerphLoadGarageTips;
    window.kerphInsertGarageTip = kerphInsertGarageTip;
    window.kerphUpdateGarageTip = kerphUpdateGarageTip;
    window.kerphDeleteGarageTip = kerphDeleteGarageTip;
    window.kerphUploadGarageTipImage = kerphUploadGarageTipImage;
    window.kerphGarageTipImageUrl = kerphGarageTipImageUrl;

    window.kerphUploadPortfolioPhoto = kerphUploadPortfolioPhoto;
    window.kerphPortfolioImageUrl = kerphPortfolioImageUrl;
    window.kerphLoadMyPortfolioProjects = kerphLoadMyPortfolioProjects;
    window.kerphLoadPublicPortfolio = kerphLoadPublicPortfolio;
    window.kerphCreatePortfolioProject = kerphCreatePortfolioProject;
    window.kerphUpdatePortfolioProject = kerphUpdatePortfolioProject;
    window.kerphDeletePortfolioProject = kerphDeletePortfolioProject;

    window.kerphUploadPrintPlanFile = kerphUploadPrintPlanFile;
    window.kerphPrintPlanFileUrl = kerphPrintPlanFileUrl;
    window.kerphLoadPrintPlans = kerphLoadPrintPlans;
    window.kerphCreatePrintPlan = kerphCreatePrintPlan;
    window.kerphDeletePrintPlan = kerphDeletePrintPlan;
    window.kerphIncrementPrintPlanDownloads = kerphIncrementPrintPlanDownloads;

    window.kerphLoadToolReviews = kerphLoadToolReviews;
    window.kerphCreateToolReview = kerphCreateToolReview;
    window.kerphLoadMyReviewVotes = kerphLoadMyReviewVotes;
    window.kerphToggleReviewHelpful = kerphToggleReviewHelpful;

    window.kerphRunLocalMigration = kerphRunLocalMigration;

    // ---------- Telemetry: error monitoring + lightweight pageview analytics ----------
    // Runs automatically on every page that loads this file — no per-page wiring needed.
    // Goes through log-telemetry (JWT off, service-role writes) rather than a direct
    // Supabase insert so it still works for signed-out visitors and doesn't need a public
    // insert policy on client_errors/analytics_events.
    let telemetryErrorCount = 0;
    const TELEMETRY_ERROR_CAP = 10; // stop reporting after this many in one page load — an
                                     // error loop shouldn't be able to flood the table

    function kerphSendTelemetry(payload) {
        try {
            fetch(`${kerphSupabase.supabaseUrl}/functions/v1/log-telemetry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: state.user ? state.user.id : null, ...payload }),
                keepalive: true, // lets the request finish even during page unload/navigation
            }).catch(() => {}); // never let telemetry reporting itself throw
        } catch (e) { /* ditto */ }
    }

    // Feeds the admin dashboard's "active users per day" number. Deduped client-side (one log
    // per signed-in user per calendar day per browser) rather than firing on every auth event —
    // see log-telemetry's 'login' handler comment for why that's the more useful metric.
    function kerphLogDailyActiveUser(userId) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const key = 'kerphLastActiveLogDate:' + userId;
            if (localStorage.getItem(key) === today) return;
            localStorage.setItem(key, today);
            kerphSendTelemetry({ type: 'login' });
        } catch (e) { /* best-effort — never let this block the auth flow */ }
    }

    function kerphGetAnonSessionId() {
        try {
            let id = localStorage.getItem('kerphAnonSessionId');
            if (!id) {
                id = crypto.randomUUID();
                localStorage.setItem('kerphAnonSessionId', id);
            }
            return id;
        } catch (e) { return null; } // localStorage can throw in some locked-down contexts
    }

    window.addEventListener('error', (event) => {
        if (telemetryErrorCount++ >= TELEMETRY_ERROR_CAP) return;
        kerphSendTelemetry({
            type: 'error',
            message: event.message || 'Unknown error',
            stack: event.error && event.error.stack ? event.error.stack : null,
            pageUrl: location.href,
            userAgent: navigator.userAgent,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        if (telemetryErrorCount++ >= TELEMETRY_ERROR_CAP) return;
        const reason = event.reason;
        kerphSendTelemetry({
            type: 'error',
            message: 'Unhandled promise rejection: ' + (reason && reason.message ? reason.message : String(reason)),
            stack: reason && reason.stack ? reason.stack : null,
            pageUrl: location.href,
            userAgent: navigator.userAgent,
        });
    });

    kerphSendTelemetry({ type: 'pageview', path: location.pathname, sessionId: kerphGetAnonSessionId() });
})();
