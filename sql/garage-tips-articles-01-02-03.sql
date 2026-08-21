-- Loads/updates the first 3 voice-rewritten Garage Tips articles into production:
-- Keeping Cast Iron Tables Rust-Free, Cleaning Pitch and Resin Off Blades and Bits Safely,
-- and How to Tune Up a Table Saw in 30 Minutes. Same safe-to-rerun UPDATE-or-INSERT pattern
-- as sql/garage-tips-articles.sql -- matches by title, updates if the row already exists,
-- inserts if it doesn't. Run this whole script once in the Supabase SQL Editor.

do $$
declare
    v_user_id uuid;
    v_updated int;
    v_title text := $title$Keeping Cast Iron Tables Rust-Free$title$;
    v_excerpt text := $excerpt$A real cleaning and protection routine for table saw and jointer tops, plus what actually holds up against rust in humid vs. dry shops.$excerpt$;
    v_body text := $body$
<p>Let's get one thing straight up front: rust on a cast iron top isn't a cosmetic problem. It's a flatness problem. The second that surface pits or hazes over orange, your stock stops sliding true and your measurements start lying to you — and you won't find out until a cut comes out wrong. Here's the part nobody wants to hear: keeping it rust-free takes about two minutes a week. The real problem was never the work. It's that almost nobody does it until they've already got rust staring back at them.</p>

<h2>Why Cast Iron Rusts in the First Place</h2>
<p>What's actually attacking your table? Not one big thing — three small ones, and they're all avoidable once you know what you're looking at.</p>
<p><strong>Humidity swings.</strong> Iron doesn't need standing water to rust. Ambient moisture in the 55-70% relative humidity range is enough on its own, and it gets worse fast when temperature swings cause condensation — a cold garage warming up on a humid morning is the classic trigger. Anywhere near a coast, or in a basement shop, this is the one that's actually coming for you.</p>
<p><strong>Hand oils and sweat.</strong> Salt and skin oils are mildly corrosive by themselves, and worse, they hold moisture against the surface far longer than bare metal would. Lean on the table with bare forearms while you work, and you'll have a rust outline to show for it days later.</p>
<p><strong>Coolant and blade residue.</strong> Cut anything with resin in it — pine, fir, MDF with wax binders — and the gummy residue that lands on the table holds moisture like a sponge. Sawdust left sitting overnight does the same thing. It's hygroscopic. It'll wick humidity straight into the iron underneath it while you sleep.</p>

<div style="margin:16px 0;">
<img src="images/garage-tips/cast-iron-rust-closeup.jpg" alt="Rust and grime staining on a cast iron machine table top" style="width:100%;max-width:480px;display:block;border-radius:8px;" />
</div>

<h2>The Real Cleaning and Protection Routine</h2>
<p>Use this when a top has gone too long without attention, or once a season as a deeper reset. Five steps, none of them hard:</p>
<p><strong>1. Degrease first.</strong> Wipe the whole top down with mineral spirits or a citrus-based degreaser on a rag. This pulls off oil, wax residue, and grime so you're not sanding contamination straight into the pores of the metal.</p>
<p><strong>2. Hit stubborn spots with a fine abrasive.</strong> Light surface rust: a gray or maroon <a href="https://www.amazon.com/s?k=3M+Scotch-Brite+pads&tag=kerphplans-20" target="_blank" rel="noopener sponsored">3M Scotch-Brite pad</a> with a few drops of mineral spirits lifts it without scratching. Actual pitting or stubborn rings: 000 or 0000 steel wool with a light machine oil as lubricant. Either way, work with the grain you're wiping in, never circles — circular scratches catch the light and you will not undo them. And don't even think about reaching for coarse sandpaper or a bench grinder wire wheel on a saw top. Both remove metal unevenly. That low spot is permanent.</p>
<p><strong>3. Neutralize and dry completely.</strong> Used anything water-based? Dry the top immediately and thoroughly. Cast iron will flash-rust within the hour if you leave it damp — faster than that in humid weather.</p>
<p><strong>4. Apply your protective layer.</strong> Which one depends on your situation — see below. Thin, even coats, let it haze over per the product's directions, then buff.</p>
<p><strong>5. Buff to a hard, dry finish.</strong> A clean microfiber cloth or an old cotton t-shirt does the job. You're aiming for slick and dry to the touch. Tacky means you left too much product on, and it's going to grab every bit of dust in the shop like it's getting paid to.</p>

<h2>Wax vs. Spray Inhibitor vs. Camellia Oil</h2>
<p>The simple answer: all three work. The real answer is that "best" depends on your climate and how often you're actually in the shop, not on the label.</p>
<p><strong>Paste wax</strong> gives you the slickest surface for feeding stock — and that's not just convenience, it's safety, since less friction means less tendency to bind or kick back. Johnson's Paste Wax used to be the classic shop answer here. "Used to" is doing a lot of work in that sentence — they discontinued it, so unless you've still got an old can hiding in a drawer somewhere, it's not an option anymore, it's a memory. <a href="https://www.amazon.com/Shop-Wax-Bumblechutes-All-Purpose-Plastics/dp/B0D8YZYP4T?tag=kerphplans-20" target="_blank" rel="noopener sponsored">Bumblechute's Shop Wax</a> is the real answer now — a proper shop-grade paste wax built for exactly this job. Either way, it holds up fine in a moderate, stable climate. In a humid shop, plan on reapplying every 2-4 weeks, because it's a physical barrier, and physical barriers thin out with use.</p>
<p><strong>Spray rust inhibitors</strong> like <a href="https://www.amazon.com/s?k=Boeshield+T-9&tag=kerphplans-20" target="_blank" rel="noopener sponsored">Boeshield T-9</a> or <a href="https://www.amazon.com/s?k=Bostik+TopCote&tag=kerphplans-20" target="_blank" rel="noopener sponsored">Bostik TopCote</a> dry to a hard, waxy film instead of staying wet, so they don't attract dust the way a bare oil does. T-9 is built for marine and aviation-grade corrosion resistance, which tells you exactly when to reach for it — a genuinely humid climate (Gulf Coast, Pacific Northwest) or a shop with no climate control. TopCote goes on thinner and glides a little better, but it doesn't last quite as long between coats. Pick your tradeoff.</p>
<p><strong>Camellia oil</strong> is the traditional choice for fine hand tools, and it's popular with anyone running Japanese saws, chisels, and planes alongside the power tools. Food-safe-adjacent, doesn't gum up, smells better than anything mineral-spirits-based. Here's the catch: it's a true oil, not a hard film, so a table saw top that sees heavy stock-sliding traffic needs it weekly — more than that in a damp shop. Save it for dry climates, or for tools that mostly sit rather than get slid on all day.</p>

<h2>When Surface Rust Isn't the Whole Story</h2>
<p>Everything above assumes light surface rust — the orange haze that wipes off with a pad and some elbow grease. That covers the vast majority of cases. But if you're running a fingernail across the top and catching real texture, not just discoloration, or if a straightedge laid across the table rocks instead of sitting flat, that's pitting, and pitting is a different problem. Pitting means metal has actually been eaten away, not just stained, and no amount of wax or oil brings that back. At that point you're deciding between living with it (fine for a jointer infeed table that doesn't need mirror-flat, less fine for a table saw top your stock slides across constantly), having it professionally surface-ground, or accepting it as the reason this particular saw's resale value just took a hit. Catch it at the surface-rust stage and none of this is ever a conversation you have to have.</p>
<p>One more thing worth saying plainly: WD-40 is not a long-term rust protectant, no matter how many forum threads insist otherwise. It's a water displacer and light penetrating oil — genuinely useful for breaking a stuck bolt free or displacing moisture in an emergency, but it evaporates and thins out fast, leaving the metal exposed again within days. If it's what's in your garage right now, it beats doing nothing for a single afternoon. It is not a substitute for an actual wax or inhibitor in your regular routine.</p>

<h2>The Weekly Habit That Actually Prevents Rust</h2>
<p>Everything above is damage control. This is the part that actually prevents it, and it takes 30 seconds: at the end of your last cut for the day, brush the loose dust off the top and wipe it down dry with a clean rag. Once a week, follow that with a light pass of whatever inhibitor you're using. You don't need a full strip-and-reapply — just enough to refresh the barrier where the fence rides and where you rest stock, the high-contact zones that take the abuse. Keep the rag and your spray or wax within arm's reach of the saw. That's the whole trick. A habit only survives if it's a five-second detour, not a project you have to talk yourself into.</p>

<p>Once your tops are actually protected, keep a simple log of what you own and when you last serviced it, so it doesn't quietly slip during a busy stretch — <a href="index.html">Kerph's tool maintenance tracker</a> makes that easy to stay on top of.</p>
$body$;
begin
    select id into v_user_id from auth.users where email = 'cjstalcup@kerphplans.com';

    update public.garage_tips
    set excerpt = v_excerpt, body_html = v_body, category = 'Tool Maintenance',
        tags = array['cast iron','rust prevention','table saw maintenance','tool care','workshop protection'],
        published = true, author = 'Kerph Team', cover_image_path = 'images/garage-tips/cast-iron-rust-free-cover.jpg',
        updated_at = now()
    where user_id = v_user_id and title = v_title;

    get diagnostics v_updated = row_count;

    if v_updated = 0 then
        insert into public.garage_tips (user_id, title, excerpt, body_html, category, tags, published, author, cover_image_path)
        values (v_user_id, v_title, v_excerpt, v_body, 'Tool Maintenance',
                array['cast iron','rust prevention','table saw maintenance','tool care','workshop protection'], true, 'Kerph Team',
                'images/garage-tips/cast-iron-rust-free-cover.jpg');
    end if;
end $$;

do $$
declare
    v_user_id uuid;
    v_updated int;
    v_title text := $title$Cleaning Pitch and Resin Off Blades and Bits Safely$title$;
    v_excerpt text := $excerpt$Built-up pitch quietly wrecks your cut quality and your safety margin — here's how to strip it off without damaging the carbide or the coating.$excerpt$;
    v_body text := $body$
<p>Run a fingernail across the face of a blade that's cut a few hundred feet of pine, and you'll feel it before you ever see it — a dark, tacky ridge sitting right where the carbide meets the plate. That's pitch and resin. And here's the part that surprises people: it's not a cosmetic problem. It's not even really about how the blade looks. It's about how the blade cuts, how hot it runs, and how it behaves the second something binds.</p>

<h2>Why Pitch Buildup Is a Bigger Deal Than It Looks</h2>
<p>So what's actually going on under that gunk? Pitch acts like insulation between the carbide and the wood, which sounds harmless right up until you think through what insulation actually does here. First: more friction. The blade pushes through the cut instead of slicing it, so cutting force and heat both climb. Second: that heat has nowhere to go, because the same layer that's ruining your cut is also blocking the carbide from shedding heat into the airstream and sawdust the way a clean edge would. Third, and this is the one that actually matters for your safety, not just your cut quality: a gummed-up blade binds in the kerf more easily. Bind even a little, and the workpiece can lift or grab — that's exactly the mechanism behind kickback. And underneath all of it, a resin-coated edge dulls faster than a clean one. You paid for a sharp blade. Congratulations, you're now running a dull one, and the carbide itself hasn't actually worn down at all.</p>

<div style="margin:16px 0;">
<img src="images/garage-tips/blade-pitch-buildup.jpg" alt="Close-up of a carbide table saw blade's teeth" style="width:100%;max-width:480px;display:block;border-radius:8px;" />
</div>

<h2>Dedicated Cleaners vs. Household Options</h2>
<p>You've got two real paths here, and both actually work — when you use them correctly.</p>
<p><strong>Dedicated blade and bit cleaners</strong> like <a href="https://www.amazon.com/s?k=CMT+Blade+and+Bit+Cleaner&tag=kerphplans-20" target="_blank" rel="noopener sponsored">CMT Blade and Bit Cleaner</a> and oxalic-acid-based options such as <a href="https://www.amazon.com/s?k=Boeshield+Blade+and+Bit+Cleaner&tag=kerphplans-20" target="_blank" rel="noopener sponsored">Boeshield Blade and Bit Cleaner</a> are built specifically to dissolve pitch and resin without attacking carbide braze joints, anti-stick coatings (the black non-stick finish on a lot of Freud and CMT blades), or aluminum router bit bodies. They're the safe default, especially for anything with a coating worth keeping, and most work in 5-10 minutes without any scrubbing.</p>
<p><strong>Household options</strong> can work, but they come with real tradeoffs. Diluted <a href="https://www.amazon.com/s?k=Simple+Green&tag=kerphplans-20" target="_blank" rel="noopener sponsored">Simple Green</a> (roughly 1:1 with water, straight for heavy buildup) is a solid budget pick — gentle enough for regular use, won't touch most coatings or braze joints, genuinely fine as an everyday cleaner. Just slower than a dedicated pitch remover on the heavy stuff. Oven cleaner is the one you'll see recommended online, and it deserves a hard caution, not a shrug. Yes, it cuts through pitch fast. It's also a strong lye solution that's more than happy to eat the aluminum shank right off a router bit while it's at it, discolor or strip an anti-stick coating, and irritate your skin and lungs if you're not gloved up and ventilated. If you're still going to use it, keep it to steel-body, uncoated blades only, keep contact time short, and rinse thoroughly. Anything with aluminum or a coated finish, leave the oven cleaner in the kitchen where it belongs.</p>

<h2>The Soak-and-Brush Process</h2>
<p>Once you've picked a cleaner, the process is the same no matter which one you went with:</p>
<p><strong>1. Lay the blade or bit flat</strong> in a shallow plastic tray or an old cake pan. Never a container you're going to reuse for food. I know it's the perfect size. No.</p>
<p><strong>2. Cover it with cleaner</strong> so both faces are wetted, or spray liberally if you're running an aerosol formula.</p>
<p><strong>3. Soak 5-15 minutes.</strong> Older, heavier buildup gets the longer end of that range. Don't walk away for hours thinking more is better — it isn't. Extended soaking doesn't clean it any faster, it just prolongs chemical exposure to metal that didn't need it.</p>
<p><strong>4. Brush the gullets and tooth faces</strong> with a nylon-bristle brush (an old toothbrush works fine) or brass bristles for the stubborn spots. Brass is soft enough not to scratch carbide or steel, but it's still got enough bite to knock resin loose.</p>
<p><strong>5. Rinse with water and dry immediately</strong> — compressed air or a clean towel, then let it finish air-drying before it goes back into storage. Leftover moisture on bare steel will flash-rust within the hour. That's not a maybe.</p>
<p><strong>6. Wipe on a light coat of oil</strong> before the blade goes back in the drawer or the tool goes back on the shelf. A drop of machine oil, or a wipe of whatever rust inhibitor you're already using on your cast iron top, keeps surface rust from showing up between uses.</p>

<h2>Slowing Buildup Before It Starts</h2>
<p>Cleaning is damage control. There's also a real prevention step most people skip entirely: a dry-film blade lubricant, sprayed on before you cut anything resinous, coats the carbide in a slick barrier that pitch has a much harder time sticking to in the first place. <a href="https://www.amazon.com/s?k=Bostik+TopCote&tag=kerphplans-20" target="_blank" rel="noopener sponsored">Bostik TopCote</a> — the same stuff a lot of shops use on cast iron tops — works here too, and a light coat before a long session ripping pine or fir measurably cuts down how much actually bonds to the tooth face. It's not a replacement for the cleaning routine above. Pitch that's going to build up eventually builds up regardless. But "eventually" stretches out a lot further, and the cleaning sessions you do end up needing come off a lot easier when they're not fighting months of baked-on residue.</p>
<p>Worth knowing while you're at it: not all blades resist pitch equally. A blade with a factory non-stick coating (Freud's Perma-Shield, CMT's Xtreme coating, and similar) genuinely does build up slower than bare steel or uncoated carbide — that coating is doing real, measurable work, not just marketing copy. It's one more reason to treat a coated blade gently when you do clean it; strip the coating off with the wrong cleaner or an abrasive pad, and you've just erased the exact advantage you paid extra for.</p>

<h2>What Not to Use</h2>
<p>Skip wire brushes and wire wheels entirely. Steel bristles are hard enough to scratch both the carbide and the anti-stick coating that was slowing down buildup in the first place — so you'd be trading a five-minute clean today for a worse one next month. Skip strong chlorinated solvents and straight acetone on coated blades and bits too; they'll soften or lift the coating right along with the resin. And never fully submerge a bit or blade that has bearings — guided bits, ball-bearing pilot bits. Solvent that gets into the bearing race washes the grease straight out, and now you've got a gritty bearing on a slow march toward failure. Wipe those by hand and keep the liquid off the bearing itself.</p>

<h2>How Often to Check</h2>
<p>Rule of thumb: check after every 4-8 hours of cutting resinous softwoods — pine, fir, spruce — or any time the saw starts working harder than it used to, the motor bogs on a cut that used to be easy, or you catch a faint burning smell at a feed rate that never smelled like anything before. A quick visual check — tilt the blade toward the light, look at the gullets — takes ten seconds and tells you everything you need to know. Hardwoods and sheet goods build up pitch a lot slower, so once a month covers it there.</p>

<p>Keeping track of when each blade and bit was actually last cleaned beats guessing — <a href="index.html">Kerph's tool maintenance tracker</a> gives you a place to log that history alongside the rest of your gear.</p>
$body$;
begin
    select id into v_user_id from auth.users where email = 'cjstalcup@kerphplans.com';

    update public.garage_tips
    set excerpt = v_excerpt, body_html = v_body, category = 'Tool Maintenance',
        tags = array['blade cleaning','pitch removal','carbide blades','router bits','table saw safety'],
        published = true, author = 'Kerph Team', cover_image_path = 'images/garage-tips/cleaning-pitch-resin-cover.jpg',
        updated_at = now()
    where user_id = v_user_id and title = v_title;

    get diagnostics v_updated = row_count;

    if v_updated = 0 then
        insert into public.garage_tips (user_id, title, excerpt, body_html, category, tags, published, author, cover_image_path)
        values (v_user_id, v_title, v_excerpt, v_body, 'Tool Maintenance',
                array['blade cleaning','pitch removal','carbide blades','router bits','table saw safety'], true, 'Kerph Team',
                'images/garage-tips/cleaning-pitch-resin-cover.jpg');
    end if;
end $$;

do $$
declare
    v_user_id uuid;
    v_updated int;
    v_title text := $title$How to Tune Up a Table Saw in 30 Minutes$title$;
    v_excerpt text := $excerpt$A real, timed checklist for aligning your blade, fence, and tilt stops, plus the exact tools you need to get shop-grade accuracy in half an hour.$excerpt$;
    v_body text := $body$
<p>Most of what people blame on their own technique — burning, cuts that drift, a fence that seems to wander no matter how careful they are — isn't a technique problem. It's an alignment problem. A saw that's a few thousandths out of parallel will fight you all day and never once tell you why. Most home shops check alignment exactly once: out of the box. This is the checklist to run every few months, or the moment the saw gets moved, drops a belt, or just starts cutting worse than it used to. Budget 30 minutes. None of it requires a machinist background — just a wrench, some patience, and a willingness to actually check instead of guess.</p>

<h2>Signs You Need This Now, Not "Eventually"</h2>
<p>Some symptoms point straight at misalignment, not technique or a dull blade. Burning on rip cuts, especially only on one face of the cut, usually means the fence has crept out of parallel — the workpiece is getting squeezed against a blade it's not quite aligned with, and friction does the rest. A cut that drifts away from the fence partway through, even with steady feed pressure, points at the same thing from the other direction. A crosscut that comes out a hair off square despite the miter gauge reading dead-on at 90&deg; means the blade itself isn't actually square to the table, not that your gauge is lying to you. And any cut that feels like it's fighting you — more resistance than the wood or blade sharpness explains — is worth checking before you reach for a new blade and spend money solving the wrong problem. None of these prove misalignment on their own. All of them are reason enough to run the checklist below before you do anything else.</p>

<h2>What You'll Need (5 minutes to gather)</h2>
<p>You don't need a full metrology kit — this isn't a machine shop. The minimum useful setup is a reliable <a href="https://www.amazon.com/s?k=Starrett+combination+square&tag=kerphplans-20" target="_blank" rel="noopener sponsored">combination square</a> and a <a href="https://www.amazon.com/s?k=feeler+gauge+set&tag=kerphplans-20" target="_blank" rel="noopener sponsored">feeler gauge set</a>. If you want something tighter than eyeballing a gap, a <a href="https://www.amazon.com/s?k=dial+test+indicator+magnetic+base&tag=kerphplans-20" target="_blank" rel="noopener sponsored">dial indicator with a magnetic base</a> turns "looks about right" into an actual number — worth owning if you're doing this more than once a year. Round out the kit with the wrench or hex key that actually fits your trunnion bolts, a scrap of hardwood, and your usual cleaning and waxing supplies.</p>

<h2>Step 1: Blade-to-Miter-Slot Alignment (5 minutes)</h2>
<p>This is the one that matters most. Everything else on this list is referenced off it, so if you only have time for one step, make it this one. Clamp a scrap block in the miter slot with a point — a screw tip works fine — just touching a tooth at the front of the blade. Rotate the blade by hand so that same tooth is now at the back, and check the gap again. Dial indicator: you want the reading to hold within 0.005" front to back. Feeler gauge: you're checking whether a given thickness just barely fits at one end and not the other. Off? Loosen the trunnion bolts under the table (check your manual for exact locations — most contractor and cabinet saws adjust the trunnion, not the blade) and nudge until front and back match. Then retorque.</p>

<h2>Step 2: Fence Parallelism (5 minutes)</h2>
<p>Now that the blade's actually trustworthy, lock the fence a set distance from it and measure from the fence face to the miter slot at the front of the table, then again at the back, same square or indicator. Fences should be dead parallel, or toe out very slightly at the back — no more than about 0.010". Never toeing in. Toe-in is what causes burning and kickback on rip cuts, because the workpiece gets pinched between the blade and the fence right as it exits — that's not a maybe, that's just physics doing what physics does. Most fences have two adjustment screws where the head locks to the rail. Loosen those, tap the fence until the reading's right, retighten while holding position.</p>

<h2>Step 3: Blade Tilt Stops at 90&deg; and 45&deg; (5 minutes)</h2>
<p>Raise the blade fully, set the tilt to 90&deg;, and check square against the flat body of the blade plate — not a tooth. Carbide teeth have inconsistent set, and checking against one will lie to you. Gap? Adjust the 90&deg; set screw (usually near the handwheel or under the table by the trunnion) until the square sits flush, lock it down, then do the same for the 45&deg; stop. Don't just trust the number — make an actual test cut in scrap and measure the resulting angle before you trust either stop on a real project.</p>

<h2>Step 4: Riving Knife Alignment (5 minutes)</h2>
<p>The riving knife has one job, and it needs to be sized right to do it: thin enough not to bind, thick enough to actually work — roughly the same thickness as the blade's kerf, thinner than the plate but wider than the blade body. What matters more day to day is whether it's coplanar with the blade. Lay a straightedge across both at the same height and check for any visible offset side to side. A knife angled off to one side pushes cut stock sideways and can bind instead of doing the one thing it's there for — preventing kickback. Most riving knives have a quick-release lever. Loosen it, square the knife against the blade by eye or straightedge, reseat.</p>

<h2>Step 5: Inspect the Blade, Check the Belt, Clean and Wax the Top (5-10 minutes)</h2>
<p>Everything's already open, so use it. Give the blade a visual check for missing carbide, a cracked plate, or the dark resin buildup that <a href="index.html">slows cuts and raises your kickback risk</a> right along with it. Coated and gummed up? This is the moment to plan a real cleaning instead of pushing through one more project on a dull edge and pretending it's fine. Belt-driven saw: check tension by pressing on the belt midway between the pulleys. You want roughly half an inch of deflection under moderate thumb pressure, no more. Too loose and it slips and bogs under load; too tight and you're straining the arbor bearings for no reason. Last thing — wipe the cast iron top clean of dust and old wax, and lay down a fresh coat of paste wax or rust inhibitor. Same routine as Kerph's guide to keeping cast iron tables rust-free. The table should be slick and protected before it goes back to work, not just clean.</p>

<h2>Putting It Together</h2>
<p>Run it in order — blade to slot, fence to blade, tilt stops, riving knife, then the inspection and cleanup pass — and 30 minutes is realistic even the first time through. Faster once it's a habit. Do this every few months in a shop that sees regular use, and immediately any time the saw gets moved, tipped, or drops a belt. A saw that's actually in alignment cuts safer and faster than any blade upgrade you could buy instead, and it costs nothing but the half hour you were going to spend complaining about the cut quality anyway.</p>
<p>Write down what you find, too — even just scribbled on a sticky note stuck to the inside of the cabinet door. A saw that measured dead-on three months ago and is now off by a few thousandths didn't get that way overnight, and knowing the trend tells you whether something's loosening gradually (a real problem worth tracking down) or whether one specific event knocked it out (obvious once you think back to what happened right before the numbers changed).</p>

<p>Missing any of the measuring tools above? They're linked up top — no need to guess at what fits. Once your kit's complete, <a href="index.html">Kerph's tool maintenance tracker</a> is worth using to log when you last actually checked alignment, so "every few months" doesn't quietly turn into eight months.</p>
$body$;
begin
    select id into v_user_id from auth.users where email = 'cjstalcup@kerphplans.com';

    update public.garage_tips
    set excerpt = v_excerpt, body_html = v_body, category = 'Tool Maintenance',
        tags = array['table saw tune-up','blade alignment','fence alignment','riving knife','saw maintenance'],
        published = true, author = 'Kerph Team', cover_image_path = 'images/garage-tips/table-saw-tune-up-cover.jpg',
        updated_at = now()
    where user_id = v_user_id and title = v_title;

    get diagnostics v_updated = row_count;

    if v_updated = 0 then
        insert into public.garage_tips (user_id, title, excerpt, body_html, category, tags, published, author, cover_image_path)
        values (v_user_id, v_title, v_excerpt, v_body, 'Tool Maintenance',
                array['table saw tune-up','blade alignment','fence alignment','riving knife','saw maintenance'], true, 'Kerph Team',
                'images/garage-tips/table-saw-tune-up-cover.jpg');
    end if;
end $$;
