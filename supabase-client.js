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
    kerphSupabase.auth.onAuthStateChange((event, session) => {
        setTimeout(async () => {
            const wasReady = state.ready;
            state.user = session ? session.user : null;
            await refreshProfile(state.user ? state.user.id : null);
            // Only on the very first ready-resolution of a real sign-in (not every later
            // auth event) — kerphRunLocalMigration itself is a fast no-op after the first
            // time via its own sentinel, but this also skips it during INITIAL_SESSION
            // signed-out resolution and other no-op events.
            if (!wasReady && state.user) {
                await kerphRunLocalMigration();
            }
            if (!state.ready) {
                state.ready = true;
                resolveReady();
            }
            notifyChange();
        }, 0);
    });

    async function kerphSignUp(email, password) {
        const { data, error } = await kerphSupabase.auth.signUp({ email, password });
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

    function kerphGetCachedUser() {
        return state.user;
    }

    // Shape-compatible with the old kerphAccount localStorage record, so the ~65 existing
    // call sites across every page (including shop-showcase.html/tool-reviews.html, which
    // attribution-stamp local-only posts with loadAccount().username) keep working unmodified.
    function kerphGetCachedProfile() {
        if (!state.profile) return {};
        return {
            username: state.profile.username || '',
            avatar: state.profile.avatar_data_url || null,
            memberSince: state.profile.created_at || null,
            unitSystem: state.profile.unit_system || 'imperial',
            maintenanceRemindersEnabled: state.profile.maintenance_reminders_enabled !== false
        };
    }

    // upsert (not update) so a missing profile row — trigger failure, edge case, whatever —
    // never permanently locks a signed-in user out of saving; the INSERT RLS policy exists
    // specifically to make this self-healing path work.
    async function kerphSaveProfile({ username, avatarDataUrl, unitSystem, maintenanceRemindersEnabled } = {}) {
        if (!state.user) return { error: { message: 'Not signed in.' } };
        const updates = { id: state.user.id, username };
        if (avatarDataUrl !== undefined) updates.avatar_data_url = avatarDataUrl;
        if (unitSystem !== undefined) updates.unit_system = unitSystem;
        if (maintenanceRemindersEnabled !== undefined) updates.maintenance_reminders_enabled = maintenanceRemindersEnabled;
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

    const cabinetTemplatesDomain = makeSingletonDomain('cabinet_templates', 'data', []);
    const kerphLoadCabinetTemplates = cabinetTemplatesDomain.load;
    const kerphSaveCabinetTemplates = cabinetTemplatesDomain.save;

    const cutlistLivePartsDomain = makeSingletonDomain('cutlist_live_parts', 'data', []);
    const kerphLoadCutListParts = cutlistLivePartsDomain.load;
    const kerphSaveCutListParts = cutlistLivePartsDomain.save;

    // Project Designer's live state is one row, five independently-autosaved columns —
    // one loader, five column-scoped savers so each save touches only its own column.
    const PROJECT_LIVE_DEFAULT = { panels: [], hardware: [], notes: '', labels: [], measurements: [] };
    async function kerphLoadProjectLiveState() {
        if (!state.user) return { data: { ...PROJECT_LIVE_DEFAULT }, error: null };
        const { data, error } = await kerphSupabase.from('project_live_state')
            .select('panels, hardware, notes, labels, measurements').eq('user_id', state.user.id).maybeSingle();
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
        return { ...row.data, id: row.id, name: row.name, layoutType: row.layout_type, savedAt: row.updated_at };
    }
    const savedLayoutsDomain = makeNamedSaveDomain('saved_layouts', rowToSavedLayout, (layout) => ({
        name: layout.name, layout_type: layout.layoutType || 'workshop', data: layout
    }));
    const kerphLoadSavedLayouts = savedLayoutsDomain.load;
    const kerphInsertSavedLayout = savedLayoutsDomain.insert;
    const kerphUpdateSavedLayout = savedLayoutsDomain.update;
    const kerphDeleteSavedLayout = savedLayoutsDomain.del;

    function rowToSavedProject(row) {
        return { ...row.data, id: row.id, name: row.name, savedAt: row.updated_at };
    }
    const savedProjectsDomain = makeNamedSaveDomain('saved_projects', rowToSavedProject, (project) => ({
        name: project.name, data: project
    }));
    const kerphLoadSavedProjects = savedProjectsDomain.load;
    const kerphInsertSavedProject = savedProjectsDomain.insert;
    const kerphUpdateSavedProject = savedProjectsDomain.update;
    const kerphDeleteSavedProject = savedProjectsDomain.del;

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

    async function kerphLoadShowcasePosts() {
        const { data, error } = await kerphSupabase.from('showcase_posts')
            .select('*, showcase_comments(*)').order('created_at', { ascending: false });
        return { data: data || [], error };
    }

    async function kerphCreateShowcasePost({ title, description, imagePath, tags, author }) {
        if (!state.user) return { data: null, error: { message: 'Not signed in.' } };
        return kerphSupabase.from('showcase_posts')
            .insert({ user_id: state.user.id, title, description, image_path: imagePath, tags, author })
            .select().single();
    }

    async function kerphDeleteShowcasePost(id, imagePath) {
        if (imagePath) await kerphSupabase.storage.from('showcase-photos').remove([imagePath]);
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

        localStorage.setItem(sentinel, 'true');
    }

    function kerphOnVisible(callback) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') callback();
        });
    }

    window.kerphSupabase = kerphSupabase;
    window.kerphAuthReady = kerphAuthReady;
    window.kerphSignUp = kerphSignUp;
    window.kerphSignIn = kerphSignIn;
    window.kerphSignOut = kerphSignOut;
    window.kerphGetCachedUser = kerphGetCachedUser;
    window.kerphGetCachedProfile = kerphGetCachedProfile;
    window.kerphSaveProfile = kerphSaveProfile;
    window.kerphOnAuthChange = kerphOnAuthChange;
    window.kerphDownscaleImage = kerphDownscaleImage;
    window.kerphOnVisible = kerphOnVisible;

    window.kerphLoadCurrentLayout = kerphLoadCurrentLayout;
    window.kerphSaveCurrentLayout = kerphSaveCurrentLayout;
    window.kerphLoadToolStatus = kerphLoadToolStatus;
    window.kerphSaveToolStatus = kerphSaveToolStatus;
    window.kerphLoadCustomTools = kerphLoadCustomTools;
    window.kerphSaveCustomTools = kerphSaveCustomTools;
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

    window.kerphLoadSavedLayouts = kerphLoadSavedLayouts;
    window.kerphInsertSavedLayout = kerphInsertSavedLayout;
    window.kerphUpdateSavedLayout = kerphUpdateSavedLayout;
    window.kerphDeleteSavedLayout = kerphDeleteSavedLayout;
    window.kerphLoadSavedProjects = kerphLoadSavedProjects;
    window.kerphInsertSavedProject = kerphInsertSavedProject;
    window.kerphUpdateSavedProject = kerphUpdateSavedProject;
    window.kerphDeleteSavedProject = kerphDeleteSavedProject;

    window.kerphLoadQuotes = kerphLoadQuotes;
    window.kerphInsertQuote = kerphInsertQuote;
    window.kerphUpdateQuote = kerphUpdateQuote;
    window.kerphDeleteQuote = kerphDeleteQuote;

    window.kerphDownscaleImageToBlob = kerphDownscaleImageToBlob;
    window.kerphUploadShowcasePhoto = kerphUploadShowcasePhoto;
    window.kerphShowcaseImageUrl = kerphShowcaseImageUrl;
    window.kerphLoadShowcasePosts = kerphLoadShowcasePosts;
    window.kerphCreateShowcasePost = kerphCreateShowcasePost;
    window.kerphDeleteShowcasePost = kerphDeleteShowcasePost;
    window.kerphAddShowcaseComment = kerphAddShowcaseComment;
    window.kerphLoadMyShowcaseLikes = kerphLoadMyShowcaseLikes;
    window.kerphToggleShowcaseLike = kerphToggleShowcaseLike;

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
})();
